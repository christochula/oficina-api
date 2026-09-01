function normalizePath(path) {
  const withoutHash = String(path ?? '')
    .replace(/^#/, '')
    .split('?')[0];
  const withLeadingSlash = withoutHash.startsWith('/')
    ? withoutHash
    : `/${withoutHash}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRoute(path) {
  const normalized = normalizePath(path);
  if (normalized === '/') return { expression: /^\/$/, keys: [], score: 100 };

  const keys = [];
  let score = 0;
  const segments = normalized
    .slice(1)
    .split('/')
    .map((segment) => {
      if (segment === '*') {
        keys.push('wildcard');
        score += 1;
        return '(.*)';
      }
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        score += 10;
        return '([^/]+)';
      }
      score += 100;
      return escapePattern(segment);
    });

  return {
    expression: new RegExp(`^/${segments.join('/')}/?$`),
    keys,
    score,
  };
}

function decodeRouteValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseHashLocation(hash = '') {
  const raw = String(hash).replace(/^#/, '') || '/';
  const [rawPath, rawQuery = ''] = raw.split('?');
  return Object.freeze({
    path: normalizePath(rawPath),
    query: new URLSearchParams(rawQuery),
  });
}

export function matchRoute(routes, path) {
  const normalizedPath = normalizePath(path);
  const matches = routes
    .map((route, index) => {
      const compiled = compileRoute(route.path);
      const match = compiled.expression.exec(normalizedPath);
      if (!match) return null;
      const params = Object.fromEntries(
        compiled.keys.map((key, keyIndex) => [
          key,
          decodeRouteValue(match[keyIndex + 1]),
        ]),
      );
      return { route, params, score: compiled.score, index };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!matches.length) return null;
  return Object.freeze({
    route: matches[0].route,
    params: Object.freeze(matches[0].params),
  });
}

export function buildHash(path, query) {
  const normalizedPath = normalizePath(path);
  const parameters = new URLSearchParams();

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => parameters.append(key, value));
  } else if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((item) => parameters.append(key, String(item)));
      } else {
        parameters.set(key, String(value));
      }
    });
  }

  const serialized = parameters.toString();
  return `#${normalizedPath}${serialized ? `?${serialized}` : ''}`;
}

export function createHashRouter({
  routes,
  defaultPath = '/login',
  notFound,
  windowRef = globalThis.window,
  onRouteChange,
  onError,
}) {
  if (!Array.isArray(routes) || !routes.length) {
    throw new TypeError('O roteador exige ao menos uma rota.');
  }
  if (!windowRef?.location) {
    throw new TypeError('O roteador exige uma janela de navegador.');
  }

  let started = false;
  let dispatchVersion = 0;

  const router = {
    async dispatch() {
      const version = ++dispatchVersion;
      const location = parseHashLocation(windowRef.location.hash);
      const match = matchRoute(routes, location.path);
      const route = match?.route ?? null;
      const handler = route?.handler ?? notFound;
      const context = Object.freeze({
        route,
        path: location.path,
        query: location.query,
        params: match?.params ?? Object.freeze({}),
        navigate: router.navigate,
      });

      try {
        if (route?.guard) {
          const guardResult = await route.guard(context);
          if (version !== dispatchVersion) return null;
          if (typeof guardResult === 'string') {
            router.navigate(guardResult, { replace: true });
            return null;
          }
          if (guardResult === false) return null;
        }

        if (typeof handler === 'function') await handler(context);
        if (version !== dispatchVersion) return null;
        if (typeof onRouteChange === 'function') onRouteChange(context);
        return context;
      } catch (error) {
        if (typeof onError === 'function') {
          onError(error, context);
          return null;
        }
        throw error;
      }
    },

    navigate(path, { replace = false, query } = {}) {
      const nextHash = buildHash(path, query);
      if (windowRef.location.hash === nextHash) {
        void router.dispatch();
        return;
      }
      if (replace && windowRef.history?.replaceState) {
        windowRef.history.replaceState(null, '', nextHash);
        void router.dispatch();
        return;
      }
      windowRef.location.hash = nextHash;
    },

    start() {
      if (started) return router;
      started = true;
      windowRef.addEventListener('hashchange', router.dispatch);
      if (!windowRef.location.hash) {
        router.navigate(defaultPath, { replace: true });
      } else {
        void router.dispatch();
      }
      return router;
    },

    stop() {
      if (!started) return;
      started = false;
      windowRef.removeEventListener('hashchange', router.dispatch);
    },
  };

  return Object.freeze(router);
}
