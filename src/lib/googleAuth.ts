import {
  SocialLogin,
} from '@capgo/capacitor-social-login';

const GOOGLE_WEB_CLIENT_ID =
  '596721536334-198eqh9fqggaav3hshg53enl54h44o2k.apps.googleusercontent.com';

const GOOGLE_DRIVE_FILE_SCOPE =
  'https://www.googleapis.com/auth/drive.file';

let initialized = false;

export type GoogleUser = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
};

async function initializeGoogle() {
  if (initialized) {
    return;
  }

  await SocialLogin.initialize({
    google: {
      webClientId:
        GOOGLE_WEB_CLIENT_ID,

      mode:
        'online',
    },
  });

  initialized = true;
}

const GOOGLE_SCOPES = [
  'email',
  'profile',
  GOOGLE_DRIVE_FILE_SCOPE,
];

export async function checkGoogleLogin():
  Promise<boolean> {
  try {
    await initializeGoogle();

    const result =
      await SocialLogin.isLoggedIn({
        provider:
          'google',
      });

    return result.isLoggedIn;
  } catch (error) {
    console.error(
      'Google login status error:',
      error
    );

    return false;
  }
}

export async function loginWithGoogle():
  Promise<GoogleUser> {
  await initializeGoogle();

  const response =
    await SocialLogin.login({
      provider:
        'google',

      options: {
        scopes:
          GOOGLE_SCOPES,

        filterByAuthorizedAccounts:
          false,
      },
    });

  const result: any =
    response.result;

  if (
    result?.responseType &&
    result.responseType !==
      'online'
  ) {
    throw new Error(
      'تعذر تسجيل الدخول بحساب Google'
    );
  }

  const profile =
    result?.profile;

  if (!profile) {
    throw new Error(
      'لم يتم استلام بيانات حساب Google'
    );
  }

  return {
    id:
      profile.id || '',

    name:
      profile.name || '',

    email:
      profile.email || '',

    imageUrl:
      profile.imageUrl || '',
  };
}

export async function getGoogleAccessToken():
  Promise<string> {
  await initializeGoogle();

  try {
    const authorization =
      await SocialLogin.getAuthorizationCode({
        provider:
          'google',
      });

    if (
      authorization?.accessToken
    ) {
      return authorization.accessToken;
    }
  } catch (error) {
    console.warn(
      'تعذر قراءة Google access token الحالي:',
      error
    );
  }

  const response =
    await SocialLogin.login({
      provider:
        'google',

      options: {
        scopes:
          GOOGLE_SCOPES,

        filterByAuthorizedAccounts:
          false,
      },
    });

  const result: any =
    response.result;

  if (
    result?.responseType !==
      'online'
  ) {
    throw new Error(
      'تعذر الحصول على صلاحية Google Drive'
    );
  }

  const accessToken =
    typeof result?.accessToken ===
      'string'
      ? result.accessToken
      : result?.accessToken?.token;

  if (!accessToken) {
    throw new Error(
      'لم يتم استلام Access Token من Google'
    );
  }

  return accessToken;
}

export async function logoutGoogle() {
  try {
    await initializeGoogle();

    await SocialLogin.logout({
      provider:
        'google',
    });
  } catch (error) {
    console.error(
      'Google logout error:',
      error
    );
  }
}
