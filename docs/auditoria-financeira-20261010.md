# Auditoria de validação financeira — LEBRIME
Data-base: 10/10/2026 (horário de Fortaleza). Versão pretendida: v20.36.
## Escopo
Validação do cadastro financeiro, vínculos, regras de cobrança e baixa, controle de perfis, endpoints publicados e integridade do legado. **A homologação funcional com senha de funcionário real e os 961 PDFs não foi executada integralmente.**
## Resultados confirmados diretamente em produção
- **663 clientes**, **766 contratos** (717 propostas, 49 apólices), **961 documentos**, **5.473 parcelas**.
- **297 parcelas com vencimento completo**; **5.176 sem data de vencimento**. Não inventar vencimentos para fatura de cartão, emissão futura ou referência parcial.
- **Zero vínculos de parcelas a contratos inexistentes**; **zero parcelas repetidas por contrato + numeração**. Zero documentos apontando para contratos inexistentes. Documentos sem contrato específico podem ser documentos do cliente, e não necessariamente erro.
- **Seis parcelas estavam sem clientId**, embora o contrato apontasse inequivocamente para um cliente cadastrado. Corrigidas as seis com condição de correspondência estrita e conferidas no banco: agora **zero divergências de clientId** entre parcela e contrato.
- **19 planos antigos** somam valores diferentes do prêmio cadastrado, com divergência entre **R$ 0,01 e R$ 0,09** por contrato; não houve alteração arbitrária de valores. Gestor e operacional passaram a classificá-los para revisão e a bloquear mensagens de cobrança nesses planos até conciliação. Duas parcelas desses planos não tinham proteção manual prévia: agora ficam protegidas por regra dinâmica.
- **176 parcelas marcadas como "Pago"**: **2 por migração** e **174 pagas registradas sem evidência anexada**; não rebaixar, estornar ou presumir comprovação. As interfaces passaram a distinguir "Pago por migração", "Pago registrado sem comprovante" e "Pago com evidência". A equipe pode anexar evidência complementar a uma baixa legada sem alterar o status, valor nem a data do pagamento, com histórico auditável.
- **5.223 registros bloqueados para cobrança** na base, protegidos também quando sem data.
- Contratos que tiveram o PDF analisado: 1 "Verificado" com vencimentos e valores completos, e 3 "Parcial" com valores conciliados sem vencimentos identificados. Os demais são legado a conferir.
## Segurança
- \`public.records\` possui RLS ativada, sem permissões diretas a \`anon\`/\`authenticated\` e sem políticas públicas. Aplicações usam serviços autenticados. Função \`lebrime_apply_record_ops\` executável por \`service_role\`, não por usuários anônimos.
- Advisor do Supabase detectou função \`public.sync_imported_insurance_commission()\` do tipo TRIGGER com \`SECURITY DEFINER\` exposta por EXECUTE a \`PUBLIC\`, \`anon\` e \`authenticated\`. **Corrigido em produção**:
  \`\`\`sql
  REVOKE EXECUTE ON FUNCTION public.sync_imported_insurance_commission()
  FROM PUBLIC, anon, authenticated;
  \`\`\`
  Reconsulta de privilégios: \`anon=false\`, \`authenticated=false\`, \`service_role=true\`. A função continua associada ao gatilho interno. O advisor não retorna mais advertências de função executável publicamente.
- Restam 3 **avisos informativos** \`rls_enabled_no_policy\`, coerentes com o modelo de acesso privado dessas tabelas. Verificar novamente se o modelo de autenticação mudar.
## Testes
- Regressões de cliente, vigência e comissões: passaram.
- Extrator de PDF: passaram testes de tabela em duas colunas, parcelas com apenas valor, duplicidades, data inválida e conciliação.
- Motor financeiro de gestão e operacional: passaram testes de bloqueio \`Não cobrar\`, migração, plano divergente, baixa sem evidência e prevenção de lembrete indevido.
- Simulação integrada de **5.473 parcelas**: passaram paginação de 60, ocultação de comissões, concorrência de gravação, contato, anotação, confirmação mediante evidência e complementação de evidência em baixa legada.
- Smoke test remoto executado via GitHub Actions: HTTP 200 para página principal, \`operacional.html\`, \`operacional-financeiro.js\`; API retorna HTTP **401 sem token** ou **com token inválido**; resposta ao OPTIONS/CORS validada. Nenhum dado privado foi usado para os testes de acesso negativo.
- CI evidenciada: https://github.com/sinistrolebrime-glitch/lebrime-corretora/actions/runs/38104095253
## Limites explícitos
O acesso autenticado por usuário real (login e interação visual na sessão operacional) **não foi executado**, pois as credenciais não estão disponíveis ao processo automatizado. A negativa correta a tokens inválidos comprova barreira básica, mas **não homologa todo o fluxo autenticado**. O portal deve ser testado por um funcionário habilitado antes de liberar uso irrestrito.
A conciliação de todos os documentos anteriores continua **incompleta**: 5.176 vencimentos permanecem sem data; alguns PDFs não os especificam. Não classificar a carteira como 100% conferida.
## Aceite posterior
Testar com perfil gestor e operacional em navegador real, com registro de contato e baixa em contrato de testes, anexar comprovante e confirmar aparecimento simultâneo na visão de gestão; verificar responsáveis, logs e deduplicação. Para o legado: conferir faturas de cartão, boletos e evidência do banco/seguradora, mantendo \`Não cobrar\` até confirmação.
