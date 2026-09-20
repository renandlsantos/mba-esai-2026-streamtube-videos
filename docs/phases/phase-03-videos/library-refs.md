# Referências de bibliotecas — 2026-09-19

Context7 foi consultado via MCP stdio no container local `mcp/context7`, imagem `1174e6a29634`, servidor 1.0.13, em 2026-09-19. Inicialmente o conector não estava exposto; a pesquisa inicial usou documentação oficial. Depois foi localizado o servidor Docker e executada a verificação MCP antes da validação final. A opção necessária foi `MCP_TRANSPORT=stdio` (o argumento CLI não alterava o transporte padrão).

Chamadas reais: `resolve-library-id` para BullMQ, AWS SDK JavaScript v3 e FFmpeg; `get-library-docs` com `/taskforcesh/bullmq`, `/aws/aws-sdk-js-v3` e `/websites/ffmpeg_documentation`. Tópicos: Queue/Worker/jobId/attempts/backoff, multipart S3/ListParts/ETag/CompleteMultipartUpload e ffprobe/thumbnail. O corpus consultado não garante documentação da versão exata instalada. APIs foram conferidas nos tipos dos pacotes fixados e nos testes reais; não se presume compatibilidade apenas pelo resultado do MCP.

| Biblioteca | Versão alvo | API/fonte oficial |
|---|---|---|
| @aws-sdk/client-s3 |3.888.0|S3Client, CreateMultipartUpload/UploadPart/ListParts/CompleteMultipartUpload/HeadObject/GetObject/PutObject/AbortMultipartUpload — https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html |
| @aws-sdk/s3-request-presigner |3.888.0|getSignedUrl — mesma documentação AWS |
| bullmq |5.58.5|Queue.add, Worker, jobId, attempts/backoff — https://docs.bullmq.io/guide/workers/ e https://docs.bullmq.io/guide/retrying-failing-jobs |
| FFmpeg/ffprobe |Pacote Debian da imagem Docker|JSON -show_streams/-show_format; frame JPEG — https://ffmpeg.org/ffprobe.html e https://ffmpeg.org/ffmpeg-protocols.html |
| NestJS/TypeORM |lockfile existente|Module/DI e repository/transactions já usados no starter |

Dependências novas estão fixadas no package-lock. Endor package-risk: tools de risco não disponíveis; UNKNOWN, sem atestado de segurança e sem usar credenciais Endor.

## Portabilidade MCP PostgreSQL — validação 2026-09-20

O starter configura `@modelcontextprotocol/server-postgres`; o exemplo Codex agora inclui o mesmo servidor, fixado em **0.6.2**, executado por `docker exec -i` no container da API. O host é `db`; usuário/senha são os valores didáticos do Compose, sem credencial real. A versão foi conferida no registro npm.

Fonte primária: [README oficial arquivado do servidor PostgreSQL MCP](https://raw.githubusercontent.com/modelcontextprotocol/servers-archived/main/src/postgres/README.md). A ferramenta query opera em transação READ ONLY. O pacote está marcado como não suportado pelo npm; esta configuração preserva a integração do starter para desenvolvimento local e não representa recomendação de uso em produção.

Validação real: handshake JSON-RPC, tools/list e `query` com `SELECT 1 AS mcp_connection_ok`, retornando 1 na stack isolada. O pacote instalado é 0.6.2; seu handshake anuncia internamente `example-servers/postgres` versão 0.1.0. Nenhuma operação de escrita ou leitura de dados pessoais foi feita pelo MCP. A configuração global do usuário não foi alterada.
