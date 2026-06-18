export type BootstrapResponse = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  runtime: {
    apiBaseUrl: string;
    nativeWakeEnabled: boolean;
    nativeWakeProvider: string;
    nativeWakeAccessKey: string;
  };
  features: {
    researchEnabled: boolean;
    googleOAuthEnabled: boolean;
  };
};
