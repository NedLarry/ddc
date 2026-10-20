export const environment = {
  /**
   * Serve every /api call from the in-browser mock (see core/mock-api).
   * Flip to false once a real backend is behind /api.
   */
  useMockApi: true,

  /**
   * Passcode the mock API accepts for the staff dashboard. It only exists so
   * the admin flow can be exercised without a backend — a real API must do
   * its own authentication.
   */
  mockAdminPasscode: 'diadem-admin',
};
