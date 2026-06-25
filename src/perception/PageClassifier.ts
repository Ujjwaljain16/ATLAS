export type PageClassification = 'SERP' | 'VIDEO_PLATFORM' | 'FORM_PAGE' | 'ARTICLE' | 'DASHBOARD' | 'AUTH_PAGE' | 'LIST_PAGE' | 'ERROR_PAGE' | 'EMPTY_PAGE' | 'OTHER';

export class PageClassifier {
  static classify(url: string, title: string, hasForms: boolean, hasVideos: boolean): PageClassification {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    // 1. EMPTY / ERROR
    if (url === 'about:blank' || !url) return 'EMPTY_PAGE';
    if (titleLower.includes('404 not found') || titleLower.includes('500 internal server error')) return 'ERROR_PAGE';

    // 2. VIDEO_PLATFORM
    if (urlLower.includes('youtube.com') || urlLower.includes('vimeo.com') || hasVideos) return 'VIDEO_PLATFORM';

    // 3. SERP
    if (urlLower.includes('google.com/search') || urlLower.includes('bing.com/search') || urlLower.includes('duckduckgo.com')) return 'SERP';

    // 4. AUTH_PAGE
    if (urlLower.includes('/login') || urlLower.includes('/signin') || urlLower.includes('/auth') || titleLower.includes('sign in') || titleLower.includes('log in')) return 'AUTH_PAGE';

    // 5. DASHBOARD
    if (urlLower.includes('/dashboard') || urlLower.includes('/admin') || titleLower.includes('dashboard')) return 'DASHBOARD';

    // 6. FORM_PAGE
    if (hasForms || urlLower.includes('/signup') || urlLower.includes('/register') || urlLower.includes('/checkout')) return 'FORM_PAGE';

    // 7. ARTICLE
    if (urlLower.includes('/blog') || urlLower.includes('/article') || urlLower.includes('/news') || urlLower.includes('/docs')) return 'ARTICLE';

    // 8. LIST_PAGE
    if (urlLower.includes('/products') || urlLower.includes('/list') || urlLower.includes('/items')) return 'LIST_PAGE';

    return 'OTHER';
  }
}
