import { linkedPackage } from '@_linked/core/utils/Package';

/** Official first-party package identity for the shape-agnostic messaging engine. */
export const messagingPackageName = '@_linked/messaging' as const;
export const messagingPackageBaseUri = 'https://linked.cm/' as const;

const registration = linkedPackage(messagingPackageName, {
  baseUri: messagingPackageBaseUri,
});

export const {
  getPackageShape,
  linkedOntology,
  linkedShape,
  linkedUtil,
  packageExports,
  packageMetadata,
  registerPackageExport,
  registerPackageModule,
} = registration;

export const packageName = registration.packageName;
