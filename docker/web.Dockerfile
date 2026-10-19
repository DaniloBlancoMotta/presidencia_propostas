FROM mcr.microsoft.com/playwright:v1.64.1-noble
ENV CI=1
# Capturas com negrito (achados D6, V23): system-ui e sans-serif resolvem para a Liberation Sans, que já
# vem na imagem, e não para a WenQuanYi Zen Hei, que não tem negrito.
RUN printf '%s\n' '<?xml version="1.0"?>' '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' '<fontconfig>' \
    '  <match target="pattern"><test name="family"><string>system-ui</string></test><edit name="family" mode="prepend" binding="strong"><string>Liberation Sans</string></edit></match>' \
    '  <match target="pattern"><test name="family"><string>sans-serif</string></test><edit name="family" mode="prepend" binding="strong"><string>Liberation Sans</string></edit></match>' \
    '</fontconfig>' > /etc/fonts/local.conf && fc-cache -f
WORKDIR /app/web
