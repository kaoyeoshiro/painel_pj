/**
 * Página de Documentação da Integração TJ-MS
 *
 * Página estática que documenta a arquitetura e uso do módulo unificado
 * de integração com TJ-MS (services/tjms/).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/layout';

export function TjmsDocsPage() {
  return (
    <PageContainer className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold">Documentação Integração TJ-MS</h1>
        <p className="text-muted-foreground mt-2">
          Módulo unificado de integração com o sistema MNI/SOAP do TJ-MS
        </p>
      </div>

      {/* Alerta sobre sincronização Backend/Frontend */}
      <Alert variant="destructive">
        <AlertDescription>
          <strong>REGRA CRÍTICA - Sincronização Backend/Frontend:</strong>
          <br />
          Ao alterar qualquer arquivo em <code>services/tjms/</code>, DEVE-SE verificar se há impacto
          nos templates dos sistemas que consomem TJ-MS. Atualize esta documentação e
          notifique a equipe de frontend se houver mudança na estrutura de dados.
        </AlertDescription>
      </Alert>

      {/* Visão Geral da Arquitetura */}
      <Card>
        <CardHeader>
          <CardTitle>Arquitetura do Módulo Unificado</CardTitle>
          <CardDescription>
            Estrutura do módulo <code>services/tjms/</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md font-mono text-sm">
            <div>services/tjms/</div>
            <div className="ml-4">__init__.py      # Exports públicos</div>
            <div className="ml-4">config.py        # Configuração centralizada</div>
            <div className="ml-4">models.py        # Modelos de dados</div>
            <div className="ml-4">client.py        # TJMSClient (async)</div>
            <div className="ml-4">parsers.py       # XMLParserTJMS</div>
            <div className="ml-4">adapters.py      # Wrappers de compatibilidade</div>
            <div className="ml-4">constants.py     # Enums para tipos de documento</div>
          </div>
        </CardContent>
      </Card>

      {/* Cards dos Módulos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">config.py</CardTitle>
            <Badge variant="secondary">Configuração</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configuração centralizada com variáveis de ambiente (TJMS_PROXY_URL, TJ_WS_USER, TJ_WS_PASS).
              Define timeouts (padrão: 30s) e endpoints.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">client.py</CardTitle>
            <Badge variant="secondary">Cliente Async</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cliente assíncrono TJMSClient com retry automático e circuit breaker.
              Métodos: consultar_processo, baixar_documento, listar_partes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">models.py</CardTitle>
            <Badge variant="secondary">Modelos de Dados</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dataclasses tipadas (ProcessoTJMS, DocumentoTJMS, ParteTJMS).
              Validação com Pydantic para garantir integridade dos dados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">constants.py</CardTitle>
            <Badge variant="secondary">Enums</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enumerações para tipos de documento (TipoDocumento), status de processo,
              e códigos de movimento processual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">adapters.py</CardTitle>
            <Badge variant="secondary">Compatibilidade</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Wrappers para manter compatibilidade com código legado que usava o cliente antigo.
              Permite migração gradual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">parsers.py</CardTitle>
            <Badge variant="secondary">Parser XML</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              XMLParserTJMS com tratamento robusto de erros. Converte XML SOAP
              em objetos Python tipados.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Códigos de Tipos de Documento */}
      <Card>
        <CardHeader>
          <CardTitle>Códigos de Tipos de Documento</CardTitle>
          <CardDescription>
            Códigos usados pela API MNI/SOAP do TJ-MS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Coluna: Decisões */}
            <div>
              <h3 className="font-semibold mb-2 text-sm">Decisões</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><code>10</code> - Sentença</li>
                <li><code>11</code> - Acórdão</li>
                <li><code>12</code> - Decisão Interlocutória</li>
                <li><code>51</code> - Despacho</li>
              </ul>
            </div>

            {/* Coluna: Petições */}
            <div>
              <h3 className="font-semibold mb-2 text-sm">Petições</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><code>1</code> - Petição Inicial</li>
                <li><code>2</code> - Contestação</li>
                <li><code>3</code> - Recurso</li>
                <li><code>60</code> - Petição Intercorrente</li>
              </ul>
            </div>

            {/* Coluna: Outros */}
            <div>
              <h3 className="font-semibold mb-2 text-sm">Outros</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><code>50</code> - Ata de Audiência</li>
                <li><code>245</code> - Certidão</li>
                <li><code>305</code> - Mandado</li>
                <li><code>999</code> - Outros Documentos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistemas que Dependem do TJ-MS */}
      <Card>
        <CardHeader>
          <CardTitle>Sistemas que Usam TJ-MS</CardTitle>
          <CardDescription>
            6 sistemas dependem da integração TJ-MS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start space-x-2">
              <Badge variant="outline">1</Badge>
              <div>
                <div className="font-semibold text-sm">Gerador de Peças</div>
                <p className="text-xs text-muted-foreground">
                  Busca dados processuais e documentos para geração de peças
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Badge variant="outline">2</Badge>
              <div>
                <div className="font-semibold text-sm">Relatório de Cumprimento</div>
                <p className="text-xs text-muted-foreground">
                  Consulta movimentações e documentos para relatórios
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Badge variant="outline">3</Badge>
              <div>
                <div className="font-semibold text-sm">Pedido de Cálculo</div>
                <p className="text-xs text-muted-foreground">
                  Extrai valores e dados para cálculos judiciais
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Badge variant="outline">4</Badge>
              <div>
                <div className="font-semibold text-sm">Prestação de Contas</div>
                <p className="text-xs text-muted-foreground">
                  Busca documentos financeiros e movimentações
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Badge variant="outline">5</Badge>
              <div>
                <div className="font-semibold text-sm">Assistência Judiciária</div>
                <p className="text-xs text-muted-foreground">
                  Consulta dados do processo e partes envolvidas
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Badge variant="outline">6</Badge>
              <div>
                <div className="font-semibold text-sm">Classificador de Documentos</div>
                <p className="text-xs text-muted-foreground">
                  Obtém metadados para classificação automática
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boas Práticas */}
      <Card>
        <CardHeader>
          <CardTitle>Boas Práticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Fazer */}
            <div>
              <h3 className="font-semibold text-green-600 mb-2 flex items-center">
                <span className="mr-2">✓</span> Fazer
              </h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Usar sempre o proxy (TJMS_PROXY_URL)</li>
                <li>• Implementar tratamento de erros robusto</li>
                <li>• Testar localmente antes de alterar</li>
                <li>• Atualizar documentação após mudanças</li>
                <li>• Usar modelos tipados (models.py)</li>
                <li>• Respeitar timeouts configurados</li>
              </ul>
            </div>

            {/* Não Fazer */}
            <div>
              <h3 className="font-semibold text-red-600 mb-2 flex items-center">
                <span className="mr-2">✗</span> Não Fazer
              </h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Fazer requests diretos ao TJ-MS</li>
                <li>• Aumentar timeout sem justificativa</li>
                <li>• Ignorar erros de parsing XML</li>
                <li>• Hardcodar credenciais no código</li>
                <li>• Alterar estrutura de dados sem comunicar</li>
                <li>• Usar cliente legado em código novo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Técnicas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Endpoint:</span>
              <code className="text-xs">Via proxy TJMS_PROXY_URL</code>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Timeout Padrão:</span>
              <code className="text-xs">30s (configurável)</code>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Autenticação:</span>
              <code className="text-xs">TJ_WS_USER, TJ_WS_PASS</code>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Protocolo:</span>
              <code className="text-xs">SOAP/XML</code>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Retry Policy:</span>
              <code className="text-xs">3 tentativas com backoff exponencial</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Circuit Breaker:</span>
              <code className="text-xs">Ativado (5 falhas consecutivas)</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
