# LEBRIME — Protocolo de continuidade para importação e renovação

Vigência: outubro/2026. Regra permanente quando banco, conector ou ambiente de trabalho estiver indisponível.

## Estados
- **PENDENTE / CHECKPOINT**: PDF e metadados preservados em local autorizado; contrato NÃO confirmado no banco.
- **CONCLUÍDO**: proposta, vínculo do cliente, documento e parcelas consultados e verificados no banco.

## Com banco indisponível
1. Ler o documento; registrar segurado e identificadores em checkpoint **privado**, junto de corretora, produtor e comissão informada, vigências, risco, prêmio, parcelamento e fonte.
2. Manter original em Google Drive controlado ou Storage autorizado; conferir arquivo e link. NÃO colocar dados pessoais, PDFs de cliente ou links privados em GitHub público.
3. Criar checkpoint privado com número de proposta como referência, status **AGUARDANDO GRAVAÇÃO** e vínculo ao PDF; não inventar ID no banco.
4. Continuar a leitura dos próximos documentos, sem tentar contornar bloqueios, sem reenvios repetitivos.
5. No portal, documentos selecionados entram em fila local IndexedDB para recuperação no mesmo navegador; essa cópia não equivale ao cadastro e não sincroniza entre dispositivos.

## Retomada
1. Reautenticar pelo fluxo regular e consultar cliente por CPF/CNPJ e seguros existentes. Conferir proposta, apólice, vigência, risco/veículo e o seguro anterior.
2. Antes de repetir uma operação incerta, consultar o servidor e verificar se contrato e documento já existem. Priorizar operações idempotentes.
3. Preservar histórico das vigências. Não supor que renovação signifique mesmo veículo, especialmente em substituição de carro.
4. Importar apenas os dados comprovados. Produtor e comissão seguem fonte ou orientação expressa; parcelas sem vencimento confirmado ficam **Não cobrar**.
5. Confirmar no banco que contrato, PDF e parcelas estão corretos, e só então marcar o checkpoint concluído. Erro de rede após envio é **GRAVAÇÃO INCERTA — VERIFICAR**, nunca cadastro concluído.
6. Se ainda houver bloqueio, manter a pendência e seguir para próximo PDF.

## Implementação no portal (v20.50)
- `continuidade-importacao.js`: IndexedDB `lebrime-import-recovery-v1`, até 50 itens locais e PDF de até 15 MB por item; tela de retomar, conferir no banco, exportar checkpoint SEM PDF ou descartar.
- `importacao-lote.js`: salva a cópia local do PDF ao selecionar os documentos, quando possível.
- `renovacao-cadastro.js`: antes da chamada de rede, registra arquivo e formulário no checkpoint; em falha mantém o item. Em sucesso, remove o checkpoint apenas após recarregar e localizar proposta e PDF.
- O checkpoint local depende do navegador, quota e permissões; manter original em Drive privado e utilizar somente dispositivo autorizado.
- Sem sincronização automática ou promessa de cadastro em caso de bloqueio. A operação definitiva depende de acesso regular e validação.
