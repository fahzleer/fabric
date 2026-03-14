/// <reference types="bun-types" />

process.env['PASETO_KEY'] ??= 'a'.repeat(64)
process.env['INTERNAL_SECRET'] ??= 'a'.repeat(64)
process.env['CORS_ORIGIN'] ??= 'http://localhost:3000'
process.env['LOG_SILENT'] ??= 'true'
