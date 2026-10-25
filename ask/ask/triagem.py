"""Recusa por regra, antes de qualquer busca ou chamada de modelo (plano-final §11, `motivo`).

Pedido de opinião, previsão eleitoral ou ataque a candidato não chega ao modelo: a resposta é a
recusa fixa. "fora_dos_planos" não sai daqui; ele é decidido depois, quando nenhum dos dois planos
trata do assunto.
"""
from __future__ import annotations

import re

from .texto import sem_acento

_REGRAS: list[tuple[str, re.Pattern]] = [
    ("ataque", re.compile(
        r"\b(corrupt\w*|ladr(ao|oes|ona)|bandid\w*|mentiros\w*|criminos\w*|genocida\w*|vagabund\w*|"
        r"canalha\w*|safad\w*|picaret\w*|idiota\w*|imbecil|burr[oa]s?|(e|eh|sao) (um |uma )?lixo|nojent\w*|golpista\w*)\b")),
    ("previsao", re.compile(
        r"\b(quem (vai )?(ganha|ganhar|vence|vencer|leva|levar)|vai (ganhar|vencer|ser eleit\w*)|"
        r"(ganhar|vencer) (a|o) (eleicao|segundo turno|2o turno)|pesquisas? (eleitora\w*|de intencao)|"
        r"intencao de voto|chances? de (ganhar|vencer|ser eleit\w*)|resultado da eleicao|favorit[oa] (na|a) eleicao)\b")),
    ("opiniao", re.compile(
        r"\b(em quem (eu )?(devo |deveria |posso )?votar|devo votar|vale a pena votar|"
        r"quem (e|eh|seria) (o |a )?(melhor|pior)|qual (dos dois|deles|candidat\w*|plano) (e|eh|seria) (o |a )?(melhor|pior)|"
        r"qual (e|eh|seria) (o |a )?(melhor|pior) (candidat\w*|plano|opcao|escolha|presidente)|"
        r"(melhor|pior) (candidat\w*|plano|opcao|escolha|presidente)|"
        r"(voce|vc|tu) (acha|recomenda|prefere|votaria|indica)|recomenda (votar|o voto)|"
        r"qual (voce|vc) (prefere|escolheria)|quem merece|e (bom|ruim) votar)\b")),
]


def recusar(pergunta: str) -> str | None:
    """Motivo da recusa (ataque, previsao, opiniao) ou None quando a pergunta pode seguir."""
    t = " ".join(re.split(r"[^a-z0-9]+", sem_acento(pergunta)))
    for motivo, padrao in _REGRAS:
        if padrao.search(t):
            return motivo
    return None
