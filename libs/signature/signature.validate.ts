import * as bc from 'bcrypt';
import * as process from 'node:process';

export async function encryptSignature(
  query: string,
  body: string,
  publicKey: string,
): Promise<string> {
  const combinedData: string = `${publicKey}|${JSON.stringify(query)}|${JSON.stringify(body)}`;
  const envSaltRound: string | undefined = process.env.SIGNATURE_SALT_ROUND;
  const salt_round: number = envSaltRound ? parseInt(envSaltRound) : 10;
  const salt: string = await bc.genSalt(salt_round);
  return await bc.hash(combinedData, salt);
}

export async function compareSignature(
  data: string,
  encrypted: string,
): Promise<boolean> {
  return bc.compare(data, encrypted);
}
