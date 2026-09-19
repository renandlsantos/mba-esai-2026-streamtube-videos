import { jsonObject, stringField } from './json-contract';
const mailpitUrl = `http://${process.env.MAIL_HOST ?? 'mailpit'}:8025`;
function address(value: unknown) {
  return { Address: stringField(value, 'Address') };
}
function message(value: unknown) {
  const record = jsonObject(value);
  if (!Array.isArray(record.To)) throw new Error('Expected recipients');
  return {
    ID: stringField(value, 'ID'),
    Subject: stringField(value, 'Subject'),
    To: record.To.map(address),
    From: address(record.From),
  };
}
export async function getMailpitMessages() {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`);
  const data = jsonObject(await res.json());
  if (!Array.isArray(data.messages)) throw new Error('Expected messages array');
  return data.messages.map(message);
}
export async function getMailpitMessage(id: string) {
  const res = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
  return { HTML: stringField(await res.json(), 'HTML') };
}
export async function clearMailpitMessages(): Promise<void> {
  await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
}
