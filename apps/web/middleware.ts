import { getSessionCookie } from 'better-auth/cookies'
import type { NextRequest } from 'next/server'
import { NextResponse, userAgent } from 'next/server'

const PROTECTED_PREFIXES = ['/checkout', '/cart', '/account', '/merchant', '/admin']
const AUTH_ONLY_PREFIXES = ['/auth/login', '/auth/register']

export function middleware(request: NextRequest): NextResponse {
	const pathname = request.nextUrl.pathname
	const sessionCookie = getSessionCookie(request)
	const isLoggedIn = sessionCookie !== null && sessionCookie !== undefined

	const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	if (isProtected && !isLoggedIn) {
		const loginUrl = new URL('/auth/login', request.url)
		loginUrl.searchParams.set('callbackUrl', pathname)
		return NextResponse.redirect(loginUrl)
	}

	const isAuthPage = AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	if (isAuthPage && isLoggedIn) {
		const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') ?? '/products'
		return NextResponse.redirect(new URL(callbackUrl, request.url))
	}

	const { device, isBot, browser, os } = userAgent(request)
	const response = NextResponse.next()
	const deviceType = device.type ?? 'desktop'
	response.headers.set('x-device-type', deviceType)
	response.headers.set('x-is-bot', isBot ? '1' : '0')
	response.headers.set('x-browser', browser.name ?? 'unknown')
	response.headers.set('x-os', os.name ?? 'unknown')

	const geo = pathname.startsWith('/en/my') ? 'my'
		: pathname.startsWith('/en/ph') ? 'ph'
		: pathname.startsWith('/id') ? 'id'
		: pathname.startsWith('/vi') ? 'vi'
		: 'th'
	response.cookies.set('fabric_geo', geo, { path: '/', maxAge: 60 * 60 * 24 * 30 })

	return response
}

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
	],
}
