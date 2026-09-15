# OrçaFácil Pro — Histórico de versões

## v3.6.0-premium-test — Sessão HttpOnly e credencial offline separada

### Novas funcionalidades
- Adicionada uma camada central de requisições (`app-api-session.js`) para toda chamada same-origin em `/api/*`.
- A camada central remove automaticamente os cabeçalhos legados `x-orca-auth` e `x-orca-user` antes de qualquer requisição chegar ao servidor.
- As chamadas autenticadas passam a depender do cookie de sessão HttpOnly criado no login.
- Criada credencial local independente (`offlinePinHash`) para validar o PIN no modo offline sem reutilizar o hash enviado ao servidor no login.
- Adicionada migração automática de registros de autenticação antigos que ainda possuíam `pinHash`.
- O hash usado no login do servidor deixa de ser persistido para contas já vinculadas à nuvem.

### Correções
- A sincronização automática não tenta mais renovar sessão reutilizando silenciosamente um hash de PIN armazenado.
- Quando a sessão da nuvem expira, o sistema solicita um novo login em vez de reutilizar a credencial do servidor em segundo plano.
- Reconexão online, notificações de acesso e sincronização agora funcionam com a existência da conta/sessão, sem depender de `auth.pinHash`.
- Alterações futuras do PIN do usuário atual são sanitizadas antes de serem persistidas no IndexedDB.
- O cache PWA passou a incluir as novas camadas de sessão e credencial local.

### Segurança
- Requisições de clientes, produtos, orçamentos, contratos, financeiro, CRM, permissões, segurança e demais módulos passam por um filtro global que impede o envio dos antigos cabeçalhos reutilizáveis.
- O PIN continua sendo transformado em hash apenas durante uma tentativa explícita de login ou cadastro inicial.
- Após login bem-sucedido, a autenticação das APIs é feita pelo cookie HttpOnly, que não fica acessível ao JavaScript.
- A credencial offline usa domínio separado (`orcafacil-offline-v1`) e não é aceita pelo servidor como credencial de API.
- O primeiro cadastro local ainda pode manter temporariamente `pendingRegistrationPinHash` somente até concluir o bootstrap da conta na nuvem; após o cadastro ele é removido.

### Interface
- Nenhuma mudança visual invasiva nesta versão.
- Sessões lembradas continuam abrindo o painel sem novo PIN quando o cookie HttpOnly ainda é válido.
- Quando o cookie expirou, a tela de login é exibida normalmente.

### Banco de dados
- Nenhuma migration destrutiva nesta versão.
- Nenhuma alteração de schema PostgreSQL necessária para a separação de credenciais do frontend.

### APIs
- `/api/auth` continua recebendo `pinHash` apenas nas ações explícitas de `login` e `register`.
- As demais APIs são consumidas por sessão HttpOnly.
- O fallback legado em `api/_db.js` permanece temporariamente no servidor para rollback/compatibilidade, mas o frontend v3.6.0 não transmite mais os cabeçalhos antigos.

### Testes e validação
- Revisão estática dos fluxos de login, 2FA, sessão persistente, sincronização, reconexão, troca de usuário e modo offline.
- A integração GitHub → Vercel deve concluir com sucesso antes de considerar o pacote implantado.
- Regressão E2E em navegador real continua obrigatória antes de promover para `main`.

### Problemas conhecidos / próximos passos
- Depois da regressão E2E, remover definitivamente o fallback legado de `api/_db.js`.
- Migrar a criação/alteração de schema em runtime para migrations versionadas.
- Planejar a migração dos identificadores locais legados para unicidade por empresa + usuário.
- Confirmar banco independente entre Preview e Produção antes de testes destrutivos.
- Adicionar suíte automatizada de testes E2E para login, 2FA, offline/online, permissões e troca de usuários.

## v3.5.0-premium-test — Isolamento local por usuário

### Novas funcionalidades
- O IndexedDB passou a usar namespace local por usuário para configurações, clientes, produtos, orçamentos e contratos.
- O namespace prefere o ID real do usuário da nuvem, mantendo os dados locais estáveis mesmo se o login for alterado.
- Foi adicionada migração automática dos registros legados sem namespace para o usuário atual.
- Foi adicionada promoção automática do espaço local quando um usuário local recebe seu ID definitivo da nuvem.
- Foi adicionado diagnóstico interno `orcaLocalScopeInfo()` para conferir o namespace ativo e a quantidade de registros por store.

### Correções
- Trocar de usuário não apaga mais o cache local do usuário anterior.
- O carregamento do novo usuário limpa apenas o namespace dele antes de aplicar o snapshot recebido da nuvem.
- Em caso de falha durante a troca de usuário, o sistema retorna ao contexto anterior sem precisar reconstruir os dados daquele usuário.
- O pull autenticado após login passa a usar a sessão HttpOnly em vez de enviar o hash do PIN como cabeçalho de autenticação.
- Cache da PWA atualizado para incluir a nova camada de isolamento local.

### Melhorias
- A separação local agora acompanha o isolamento já existente no servidor por `owner_user_id`.
- A mudança reduz o risco de exposição de dados entre usuários que utilizam o mesmo navegador ou computador.
- A troca entre Administrador e Operadores passa a reaproveitar o cache correto de cada perfil sem misturar os stores principais.

### Mudanças de interface
- Nenhuma mudança visual invasiva nesta versão.
- A tela de troca de usuário continua exibindo o estado “Carregando seu espaço...”, mas agora a operação trabalha somente no namespace do usuário autenticado.

### Banco de dados
- Nenhuma migration destrutiva no PostgreSQL nesta versão.
- O isolamento desta etapa acontece no IndexedDB do navegador; o schema do servidor não foi alterado.

### APIs
- O fluxo de login continua criando sessão HttpOnly.
- A leitura inicial de `/api/data` após autenticação usa essa sessão do navegador.
- O fallback legado do servidor ainda existe temporariamente para compatibilidade com módulos antigos e será removido em uma etapa posterior.

### Testes e validação
- Revisão estática dos fluxos de login, troca de usuário, migração de dados locais e pull da nuvem.
- Build/deploy deve ser validado na Vercel antes de qualquer promoção para `main`.
- A regressão E2E em navegador real ainda é obrigatória antes da promoção.

### Problemas conhecidos / próximos passos
- Alguns módulos antigos ainda enviam cabeçalhos legados com hash do PIN; a próxima etapa de segurança deve centralizar as requisições em sessão HttpOnly e remover esses cabeçalhos de todo o frontend.
- O hash local do PIN ainda é mantido para permitir autenticação offline; ele deve ser separado da credencial de servidor na próxima etapa.
- A criação/alteração de schema ainda acontece em funções de inicialização; migrar para migrations versionadas continua recomendado.
- Os identificadores locais das tabelas principais ainda usam unicidade por empresa em schemas legados; a migração para empresa + usuário deve ser planejada separadamente.
- A separação de banco entre Preview e Produção precisa ser confirmada antes de testes destrutivos ou promoção.

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
- Corrigido acesso direto às funções avançadas do `/api/suite` sem autorização fina por módulo.
- Custos de produtos passam a ser omitidos/protegidos quando o usuário não possui permissão de custos.
- Exclusões pela API principal exigem tanto acesso ao módulo quanto permissão de excluir.
- Registros avançados são filtrados por grupo de permissão (Operações, CRM, Financeiro, Relatórios, Contratos e Segurança).
- Administradores continuam com acesso total automático e não podem receber um conjunto parcial de permissões pela API avançada.
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
- A API avançada valida permissões por tipo de registro e por ação sensível, incluindo 2FA, sessões, backups, links públicos e expiração de orçamentos.
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
- Revisão estática dos fluxos de autenticação, sincronização, RLS, permissões, API avançada, aprovação pública e assinatura.
- Teste E2E completo em navegador real ainda deve ser executado antes de promoção para `main`.

### Problemas conhecidos / próximos passos
- O mapeamento de permissões dos registros avançados precisa de regressão E2E em cada fluxo da interface antes da promoção para produção.
- Os stores IndexedDB continuam globais no navegador; a próxima evolução estrutural deve criar namespace local por usuário.
- Os identificadores locais das tabelas principais ainda usam unicidade por empresa em alguns schemas legados; migrar para unicidade por empresa + usuário exige migração controlada.
- A criação/alteração de schema ainda acontece em funções de inicialização; migrar para migrations versionadas é recomendado antes da produção definitiva.
- O hash do PIN ainda existe no cliente para compatibilidade/offline; a migração final deve usar credencial local separada e sessão de servidor sem reutilizar esse hash nas requisições.
- A separação de banco entre Preview e Produção precisa ser confirmada antes de testes destrutivos ou promoção.

## v3.3.0-premium-test
- Base Premium de testes com usuários, permissões, recursos avançados, dashboard administrativo, Perfil rápido e Orçamentos & pagamentos unificados.
