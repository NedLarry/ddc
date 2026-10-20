import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';

import { environment } from '../environments/environment';
import { adminAuthInterceptor } from './admin/admin-auth.interceptor';
import { mockApiInterceptor } from './core/mock-api/mock-api.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(
      // The mock must stay last: it answers requests instead of forwarding them.
      withInterceptors([adminAuthInterceptor, ...(environment.useMockApi ? [mockApiInterceptor] : [])])
    ),
  ],
};
