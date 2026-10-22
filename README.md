# MedCof · Parcerias com Centros Acadêmicos

Site estático (HTML/CSS/JS) publicado na Vercel, com dados no Supabase (projeto **MEDCOF PARCERIAS**).

| Página | Para quem | O que faz |
|---|---|---|
| `/` | CAs | Apresentação da parceria |
| `/cadastro` | CAs | Cadastro do CA/DA → gera o código único |
| `/eventos` | CAs | Registro de eventos com o código |
| `/painel` | Equipe MedCof | Visão geral, CAs, funil, eventos, equipe |

- Configuração do Supabase: `config.js` (chave publicável; a segurança fica nas regras RLS do banco).
- Acesso ao painel: crie conta em `/painel`. E-mails `marcos.antonio@medcof.com.br` e `qgdoadolffo@gmail.com` viram admin automaticamente; os demais ficam "Aguardando" até um admin liberar em **Equipe**.
