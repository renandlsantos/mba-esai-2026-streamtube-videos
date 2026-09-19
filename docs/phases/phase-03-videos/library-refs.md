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
