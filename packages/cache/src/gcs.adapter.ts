import * as crypto from "node:crypto";
import * as path from "node:path";
import { Storage } from "@google-cloud/storage";
import { Result, TaggedError } from "better-result";

export interface GcsAdapterOptions {
  bucketName: string;
  projectId?: string;
}

export interface UploadResult {
  publicUrl: string;
  gcsPath: string;
  filename: string;
}

export class GcsUploadError extends TaggedError("GcsUploadError")<{ message: string }>() {}
export class GcsDeleteError extends TaggedError("GcsDeleteError")<{ message: string }>() {}
export class GcsSignedUrlError extends TaggedError("GcsSignedUrlError")<{ message: string }>() {}

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

    return Result.tryPromise(
      {
        try: () =>
          file
            .save(buffer, { contentType, metadata: { productId, originalFilename }, predefinedAcl: "publicRead" })
            .then(() => ({
              publicUrl: this.buildPublicUrl(gcsPath),
              gcsPath,
              filename: uniqueName,
            })),
        catch: (e) => new GcsUploadError({ message: String(e) }),
      },
    );
  }

  deleteProductImage(urlOrPath: string): Promise<Result<void, GcsDeleteError>> {
    const gcsPath = urlOrPath.startsWith("https://storage.googleapis.com/")
      ? urlOrPath.replace(`https://storage.googleapis.com/${this.bucketName}/`, "")
      : urlOrPath;

    return Result.tryPromise({
      try: () =>
        this.storage.bucket(this.bucketName).file(gcsPath).delete({ ignoreNotFound: true }).then(() => undefined),
      catch: (e) => new GcsDeleteError({ message: String(e) }),
    });
  }

  deleteAllProductImages(productId: string): Promise<Result<void, GcsDeleteError>> {
    const prefix = `products/${productId}/images/`;

    return Result.tryPromise({
      try: async () => {
        const [files] = await this.storage.bucket(this.bucketName).getFiles({ prefix });
        await Promise.allSettled(files.map((f) => f.delete()));
      },
      catch: (e) => new GcsDeleteError({ message: String(e) }),
    });
  }

  buildPublicUrl(gcsPath: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;
  }

  getSignedUrl(gcsPath: string, expiresInMs: number): Promise<Result<string, GcsSignedUrlError>> {
    return Result.tryPromise({
      try: () =>
        this.storage
          .bucket(this.bucketName)
          .file(gcsPath)
          .getSignedUrl({ action: "read", expires: Date.now() + expiresInMs })
          .then(([url]) => url),
      catch: (e) => new GcsSignedUrlError({ message: String(e) }),
    });
  }
}
