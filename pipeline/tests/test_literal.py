"""AC 6: normalização e checagem literal."""
from rag_planos.literal import normalizar, trecho_na_pagina


def test_normaliza():
    assert normalizar("a  b\n\tc") == "a b c"
    assert normalizar("Sistema Único de Saú-\nde") == "Sistema Único de Saúde"
    assert normalizar("Saú-  \n   de") == "Saúde"
    assert normalizar("bem-estar") == "bem-estar"  # hífen no meio da linha fica


def test_trecho_literal_aceito_e_rejeitado():
    pagina = "Vamos ampliar a escola em tempo\nintegral em todo o país."
    assert trecho_na_pagina("ampliar a escola em tempo integral", pagina)
    assert not trecho_na_pagina("ampliar a escola em tempo parcial", pagina)
    assert not trecho_na_pagina("Ampliar a escola", pagina)  # maiúscula diferente não passa
    assert not trecho_na_pagina("", pagina)
