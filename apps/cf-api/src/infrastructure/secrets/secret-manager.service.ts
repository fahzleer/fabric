export interface SecretsMap {
  get(key: string): string | undefined;
}

class EnvSecretsMap implements SecretsMap {
  get(key: string): string | undefined {
    return process.env[key];
  }
}

class GcpSecretsMap implements SecretsMap {
  constructor(private readonly secrets: Map<string, string>) {}
  get(key: string): string | undefined {
    return this.secrets.get(key) ?? process.env[key];
  }
}

const SECRET_NAMES = ["PASETO_KEY", "INTERNAL_SECRET"] as const;
type SecretName = (typeof SECRET_NAMES)[number];

export async function loadSecrets(): Promise<SecretsMap> {
  const useSecretManager = process.env.USE_SECRET_MANAGER === "true";
  const projectId = process.env.GCP_PROJECT_ID;

  if (!(useSecretManager && projectId)) {
    return new EnvSecretsMap();
  }

  // If Firebase Functions already bound secrets as env vars, use them directly
  // (avoids redundant Secret Manager API call and cold-start latency)
  if (SECRET_NAMES.every((name) => process.env[name])) {
    return new EnvSecretsMap();
  }

  try {
    const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
    const client = new SecretManagerServiceClient();

    const secretsMap = new Map<string, string>();

    for (const name of SECRET_NAMES) {
      try {
        const secretPath = `projects/${projectId}/secrets/${name}/versions/latest`;
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Secret Manager timeout after 10s")), 10_000)
        );
        const [version] = await Promise.race([
          client.accessSecretVersion({ name: secretPath }),
          timeout,
        ]);
        const payload = version.payload?.data;
        if (payload) {
          const value =
            typeof payload === "string" ? payload : Buffer.from(payload).toString("utf8");
          secretsMap.set(name as SecretName, value.trim());
        }
      } catch (err) {
        const envValue = process.env[name];
        if (envValue) {
          secretsMap.set(name as SecretName, envValue);
        }
        console.warn(
          `[secret-manager] Could not load ${name} from Secret Manager, using env: ${String(err)}`
        );
      }
    }

    await client.close();
    return new GcpSecretsMap(secretsMap);
  } catch (err) {
    console.warn(
      `[secret-manager] Secret Manager unavailable, falling back to env vars: ${String(err)}`
    );
    return new EnvSecretsMap();
  }
}
