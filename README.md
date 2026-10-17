# Despesas Complementares — app web 1.0.0

Site estático (GitHub Pages, pasta `docs/`) que conversa com o Supabase só por funções (RPC).
Nenhuma senha fica no código: as senhas ficam no banco, com hash bcrypt.

## Publicar
1. Supabase → SQL Editor → colar `sql/01_funcoes_web.sql` → Run.
2. Abrir `sql/02_senha_admin_MODELO.sql`, trocar TROQUE_AQUI pela senha nova do administrador → Run → fechar sem salvar.
3. GitHub: criar repositório (ex.: Despesas-Web), subir só a pasta `docs/` e este README.
   Settings → Pages → Branch main, pasta /docs.
4. Entrar como administrador → Usuários: definir as senhas dos outros logins e enviar as duas assinaturas.
