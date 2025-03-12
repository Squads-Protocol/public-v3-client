import {Connection, RpcResponseAndContext, SignatureStatus} from '@solana/web3.js';

export async function waitForConfirmation(
  connection: Connection, // Adjust type based on your connection object
  signatures: string[],
  timeoutMs: number = 5000,
  sigCheckWait: number = 500
): Promise<(null | SignatureStatus)[]> {
  const startTime = Date.now();
  let latestStatuses: (null | SignatureStatus)[] = [];

  return new Promise((resolve) => {
    const checkStatus = async () => {
      while (Date.now() - startTime < timeoutMs) {
        const response: RpcResponseAndContext<(SignatureStatus | null)[]> =
          await connection.getSignatureStatuses(signatures);
        latestStatuses = response.value; // Store latest response

        // Check if the signatures are confirmed
        if (latestStatuses.every((status) => status?.confirmationStatus === 'confirmed')) {
          return resolve(latestStatuses);
        }

        await new Promise((r) => setTimeout(r, sigCheckWait));
      }
      console.log(latestStatuses);
      // Timeout reached, return the last known status
      resolve(latestStatuses);
    };

    Promise.race([
      checkStatus(),
      new Promise<void>((r) => setTimeout(r, timeoutMs)).then(() => resolve(latestStatuses)), // Ensure latestStatuses is returned
    ]);
  });
}
