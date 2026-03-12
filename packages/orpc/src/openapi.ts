import { OpenAPIGenerator } from "@orpc/openapi";

export interface OpenApiOptions {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly serverUrl: string;
}

type OrpcRouter = Parameters<OpenAPIGenerator["generate"]>[0];

export const generateOpenApiSpec = async (
  router: OrpcRouter,
  options: OpenApiOptions
): Promise<ReturnType<OpenAPIGenerator["generate"]>> => {
  const generator = new OpenAPIGenerator();
  return generator.generate(router, {
    info: {
      title: options.title,
      version: options.version,
      ...(options.description !== undefined ? { description: options.description } : {}),
    },
    servers: [
      {
        url: options.serverUrl,
        description: "API server",
      },
    ],
  });
};
