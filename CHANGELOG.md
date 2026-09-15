# OrçaFácil Pro — Histórico de versões

## v3.4.0-premium-test — Estabilização, segurança e sincronização

### Novas funcionalidades
- Fila durável de alterações locais para clientes, produtos, orçamentos, contratos e configurações.
- Reenvio automático das alterações pendentes quando a conexão volta.
- Indicador de quantidade de alterações aguardando sincronização.
- Expiração de 30 dias para links públicos de orçamento.
- Marcas de desempenho no carregamento principal e dos módulos complementares.

### Correções
- Corrigido risco de um snapshot local antigo sobrescrever dados mais novos da nuvem na abertura do sistema.
- Corrigida perda de alterações feitas offline após recarregar ou reconectar.
- Corrigido N+1 na leitura dos itens de orçamento: os itens agora são carregados em lote.
- Corrigido acesso direto à API principal sem respeitar permissões de módulos.
- Custos de produtos passam a ser omitidos/protegidos quando o usuário não possui permissão de custos.
- Exclusões pela API exigem tanto acesso ao módulo quanto permissão de excluir.
- Aprovação/recusa pública de orçamento agora é de resposta única, inclusive contra requisições concorrentes.
- Assinatura pública agora é de uso único mesmo em requisições concorrentes.
- Links públicos de orçamento expirados deixam de aceitar resposta.
- URLs externas da página pública de pagamento aceitam apenas HTTP/HTTPS.
- Cache da PWA deixa de armazenar respostas inválidas e passou a pré-carregar os módulos atuais.
- Reduzidas escritas de atualização de sessão no banco e DDL repetido de sessão em processos quentes.
- Reduzido polling de permissões/UI e eliminado o flash inicial de módulos não permitidos para Operador sem cache.

### Segurança
- APIs passam a preferir a sessão HttpOnly para autenticação.
- O cabeçalho legado com hash do PIN continua temporariamente apenas para compatibilidade durante a migração.
- Permissões de clientes, produtos, orçamentos, contratos, configurações e exclusões agora são validadas no servidor da API principal.
- Financeiro, recebimentos, PIX e compartilhamento de orçamento receberam validação de permissão no servidor.
- Páginas públicas receberam cabeçalhos contra framing, sniffing e vazamento de referência.

### Banco de dados
- `public_budget_links` ganhou `expires_at`, preenchido para registros antigos e com padrão de 30 dias.
- Novo índice por expiração dos links públicos.
- Nenhuma remoção destrutiva de dados nesta versão.

### Interface e desempenho
- Carregamento essencial continua separado das melhorias complementares.
- Permissões são hidratadas do cache antes da consulta à API; Operadores sem cache começam em estado restritivo.
- Atualizações visuais de permissão são evitadas quando o estado não mudou.
- Cache offline atualizado para a geração v4.

### Testes e validação
- Validação de build/deploy pela integração GitHub → Vercel.
- Revisão estática dos fluxos de autenticação, sincronização, RLS, permissões, aprovação pública e assinatura.
- Teste E2E completo em navegador real ainda deve ser executado antes de promoção para `main`.

### Problemas conhecidos / próximos passos
- O endpoint `/api/suite` ainda precisa de autorização fina por módulo para todas as funções avançadas; o isolamento por proprietário/RLS permanece ativo.
- Os stores IndexedDB continuam globais no navegador; a próxima evolução estrutural deve criar namespace local por usuário.
- Os identificadores locais das tabelas principais ainda usam unicidade por empresa em alguns schemas legados; migrar para unicidade por empresa + usuário exige migração controlada.
- A criação/alteração de schema ainda acontece em funções de inicialização; migrar para migrations versionadas é recomendado antes da produção definitiva.
- A separação de banco entre Preview e Produção precisa ser confirmada antes de testes destrutivos ou promoção.

## v3.3.0-premium-test
- Base Premium de testes com usuários, permissões, recursos avançados, dashboard administrativo, Perfil rápido e Orçamentos & pagamentos unificados.
