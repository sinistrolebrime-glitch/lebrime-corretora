# LEBRIME — Identidade visual na exportação de relatórios PDF

A partir da versão **20.58**, a geração de PDF dos relatórios **Renovações, Pendências e Comissões** do portal usa um único modelo institucional.

## Logo oficial
- Ativo: `assets/logo-lebrime-transparente.svg`.
- Monograma L com aro dourado vetorizado a partir da marca enviada pela empresa. Fundo verdadeiramente transparente: não existe retângulo branco dentro do SVG.
- O caminho relativo é resolvido por `new URL('assets/logo-lebrime-transparente.svg', document.baseURI)` antes de abrir o documento de impressão, de forma compatível com GitHub Pages em `/lebrime-corretora/`.
- Nunca substituir pelo JPG/PNG original de fundo branco no cabeçalho. Manter o SVG versionado no repositório.

## Implementação
- Template compartilhado: `relatorios-pdf.js`, carregado antes de `script.js`.
- Exportação: `window.open` + documento HTML preparado para A4 paisagem + `window.print()`. No diálogo do navegador, selecionar **Salvar como PDF**.
- A impressão espera o carregamento da logomarca. Se a imagem falhar, não gera automaticamente um PDF sem a marca.
- Cabeçalho contém logomarca ouro, LEBRIME CORRETORA DE SEGUROS, tipo do relatório e data/hora de emissão; tabelas repetem os títulos nas páginas seguintes; rodapé discreto.
- Botões `Gerar PDF` em **Renovações**, **Pendências** e **Comissões**.
- Os filtros ativos e a pesquisa de cada módulo são respeitados na exportação; não altera dados do banco, comissões nem parcelas.
- Arquivos PDF de seguradoras anteriormente anexados são documentos originais: NÃO aplicar logomarca sobre eles, nem regravar PDFs privados do Drive.

## Validação
- Teste `tests/report_pdf_brand.cjs` verifica existência do ativo sem fundo, cabeçalho comum, A4, tabela, sanitização dos campos, três exportações e espera de imagem antes da impressão.
- Execução via `.github/workflows/regressao.yml`.
- Ao alterar a logo, garantir que continue dentro da identidade da empresa e atualizar versão de cache do `index.html`.

## Orientação operacional
1. Abrir **Renovações**, **Pendências** ou **Comissões**.
2. Selecionar mês/status, produtor e demais filtros conforme o relatório.
3. Clicar **Gerar PDF**.
4. No navegador escolher destino **Salvar como PDF**, mantendo layout A4 paisagem.
5. Conferir os totais e o documento antes de compartilhá-lo.
