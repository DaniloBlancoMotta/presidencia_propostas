"""Limite de taxa do /ask (plano-final §11): 10 perguntas por hora por IP.

A chave é HMAC-SHA256(ip, chave do dia). A chave do dia é aleatória, nasce na memória a cada dia UTC
e nunca é gravada: nem quem tem acesso ao servidor consegue voltar da chave ao IP depois que o dia
vira. O IP em claro não fica guardado em lugar nenhum. A janela é deslizante de 3600 s.
"""
from __future__ import annotations

import hashlib
import hmac
import math
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Callable

from . import config


class Limite:
    def __init__(self, maximo: int = config.LIMITE_POR_HORA, janela: float = config.JANELA_LIMITE_S,
                 agora: Callable[[], float] = time.time):
        self.maximo, self.janela, self.agora = maximo, janela, agora
        self._dia = ""
        self._chave_do_dia = b""
        self._pedidos: dict[str, deque] = {}
        self._trava = threading.Lock()

    def chave(self, ip: str) -> str:
        dia = datetime.fromtimestamp(self.agora(), tz=timezone.utc).strftime("%Y-%m-%d")
        if dia != self._dia:  # dia novo: chave nova e contagens zeradas (a chave antiga não existe mais)
            self._dia, self._chave_do_dia, self._pedidos = dia, secrets.token_bytes(32), {}
        return hmac.new(self._chave_do_dia, ip.encode("utf-8"), hashlib.sha256).hexdigest()

    def registrar(self, ip: str) -> tuple[bool, int]:
        """(permitido, segundos até poder de novo). Só conta o pedido permitido."""
        with self._trava:
            k = self.chave(ip)
            t = self.agora()
            fila = self._pedidos.setdefault(k, deque())
            while fila and fila[0] <= t - self.janela:
                fila.popleft()
            if len(fila) >= self.maximo:
                return False, max(1, math.ceil(fila[0] + self.janela - t))
            fila.append(t)
            if len(self._pedidos) > 50_000:  # memória: tira quem já não tem pedido na janela
                self._pedidos = {c: f for c, f in self._pedidos.items() if f and f[-1] > t - self.janela}
            return True, 0
