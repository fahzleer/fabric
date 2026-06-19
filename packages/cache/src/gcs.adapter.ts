import * as crypto from "node:crypto";
import * as path from "node:path";
import { type Result, type TaggedError, tryCatchAsync } from "@fabric/types";
import { Storage } from "@google-cloud/storage";

export interface GcsAdapterOptions {
  bucketName: string;
  projectId?: string;
}

export interface UploadResult {
  publicUrl: string;
  gcsPath: string;
  filename: string;
}

export class GcsUploadError implements TaggedError<"GcsUploadError"> {
  readonly _tag = "GcsUploadError";
  constructor(readonly message: string) {}
}

export class GcsDeleteError implements TaggedError<"GcsDeleteError"> {
  readonly _tag = "GcsDeleteError";
  constructor(readonly message: string) {}
}

export class GcsSignedUrlError implements TaggedError<"GcsSignedUrlError"> {
  readonly _tag = "GcsSignedUrlError";
  constructor(readonly message: string) {}
}

export class GcsStorageAdapter {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(opts: GcsAdapterOptions) {
    this.storage = new Storage({
      ...(opts.projectId !== undefined && { projectId: opts.projectId }),
    });
    this.bucketName = opts.bucketName;
  }

  uploadProductImage(
    productId: string,
    originalFilename: string,
    buffer: Buffer,
    contentType: string
  ): Promise<Result<UploadResult, GcsUploadError>> {
    const ext = path.extname(originalFilename) || ".webp";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const gcsPath = `products/${productId}/images/${uniqueName}`;
    const file = this.storage.bucket(this.bucketName).file(gcsPath);

    return tryCatchAsync<UploadResult, GcsUploadError>(async () => {
      await file.save(buffer, {
        contentType,
        metadata: { productId, originalFilename },
        predefinedAcl: "publicRead",
      });
      return {
        publicUrl: this.buildPublicUrl(gcsPath),
        gcsPath,
        filename: uniqueName,
      };
    }).then((result) =>
      result._tag === "Err"
        ? { _tag: "Err" as const, error: new GcsUploadError(String(result.error)) }
        : result
    );
  }

  deleteProductImage(urlOrPath: string): Promise<Result<void, GcsDeleteError>> {
    const gcsPath = urlOrPath.startsWith("https://storage.googleapis.com/")
      ? urlOrPath.replace(`https://storage.googleapis.com/${this.bucketName}/`, "")
      : urlOrPath;

    return tryCatchAsync<void, GcsDeleteError>(async () => {
      await this.storage.bucket(this.bucketName).file(gcsPath).delete({ ignoreNotFound: true });
    }).then((result) =>
      result._tag === "Err"
        ? { _tag: "Err" as const, error: new GcsDeleteError(String(result.error)) }
        : result
    );
  }

  deleteAllProductImages(productId: string): Promise<Result<void, GcsDeleteError>> {
    const prefix = `products/${productId}/images/`;

    return tryCatchAsync<void, GcsDeleteError>(async () => {
      const [files] = await this.storage.bucket(this.bucketName).getFiles({ prefix });
      await Promise.allSettled(files.map((f) => f.delete()));
    }).then((result) =>
      result._tag === "Err"
        ? { _tag: "Err" as const, error: new GcsDeleteError(String(result.error)) }
        : result
    );
  }

  buildPublicUrl(gcsPath: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;
  }

  getSignedUrl(gcsPath: string, expiresInMs: number): Promise<Result<string, GcsSignedUrlError>> {
    return tryCatchAsync<string, GcsSignedUrlError>(async () => {
      const [url] = await this.storage
        .bucket(this.bucketName)
        .file(gcsPath)
        .getSignedUrl({ action: "read", expires: Date.now() + expiresInMs });
      return url;
    }).then((result) =>
      result._tag === "Err"
        ? { _tag: "Err" as const, error: new GcsSignedUrlError(String(result.error)) }
        : result
    );
  }
}
