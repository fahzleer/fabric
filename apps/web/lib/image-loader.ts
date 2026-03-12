import type { ImageLoaderProps } from 'next/image'

interface LoaderConfig {
	src: string
	width: number
	quality?: number | undefined
}

type LoaderType = 'cloudinary' | 'imgix' | 'aws' | 'default'

const LOADER_TYPE = (process.env.IMAGE_LOADER as LoaderType) ?? 'default'
const LOADER_DOMAIN = process.env.IMAGE_LOADER_DOMAIN ?? ''
const LOADER_PREFIX = process.env.IMAGE_LOADER_PREFIX ?? ''

function cloudinaryLoader({ src, width, quality }: LoaderConfig): string {
	const normalizedSrc = src.startsWith('/') ? src.slice(1) : src
	const params = [
		'f_auto',
		'c_limit',
		`w_${width}`,
		`q_${quality ?? 'auto'}`,
		'dpr_auto',
	]

	return `https://res.cloudinary.com/${LOADER_DOMAIN}/image/upload/${params.join(',')}/${LOADER_PREFIX}${normalizedSrc}`
}

function imgixLoader({ src, width, quality }: LoaderConfig): string {
	const normalizedSrc = src.startsWith('/') ? src.slice(1) : src
	const params = new URLSearchParams({
		auto: 'format,compress',
		fit: 'max',
		w: width.toString(),
		q: (quality ?? 75).toString(),
	})

	return `https://${LOADER_DOMAIN}/${LOADER_PREFIX}${normalizedSrc}?${params.toString()}`
}

function awsLoader({ src, width, quality }: LoaderConfig): string {
	const normalizedSrc = src.startsWith('/') ? src.slice(1) : src
	const params = new URLSearchParams({
		width: width.toString(),
		quality: (quality ?? 75).toString(),
		format: 'auto',
	})

	return `https://${LOADER_DOMAIN}/${LOADER_PREFIX}${normalizedSrc}?${params.toString()}`
}

function defaultLoader({ src, width, quality }: LoaderConfig): string {
	if (src.startsWith('/')) {
		return src
	}

	const params = new URLSearchParams()
	params.set('w', width.toString())
	if (quality) {
		params.set('q', quality.toString())
	}

	return `${src}?${params.toString()}`
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
	const config: LoaderConfig = { src, width, quality: quality ?? 75 }

	switch (LOADER_TYPE) {
		case 'cloudinary':
			return cloudinaryLoader(config)
		case 'imgix':
			return imgixLoader(config)
		case 'aws':
			return awsLoader(config)
		case 'default':
		default:
			return defaultLoader(config)
	}
}

export function generateSrcSet(
	src: string,
	widths: number[],
	quality?: number
): string {
	const effectiveQuality = quality ?? 80
	return widths
		.map((width) => `${imageLoader({ src, width, quality: effectiveQuality })} ${width}w`)
		.join(', ')
}

export function getImageDimensions(src: string): { width: number | undefined; height: number | undefined } {
	try {
		const url = new URL(src, 'http://localhost')
		const width = url.searchParams.get('width') ?? url.searchParams.get('w')
		const height = url.searchParams.get('height') ?? url.searchParams.get('h')

		return {
			width: width ? parseInt(width, 10) : undefined,
			height: height ? parseInt(height, 10) : undefined
		}
	} catch {
		return { width: undefined, height: undefined }
	}
}
