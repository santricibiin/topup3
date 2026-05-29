/**
 * Tipe response standar API internal.
 * Selalu konsisten: { success, data?, error? }
 */
export interface ApiOk<T> {
  success: true;
  data: T;
}

export interface ApiErr {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;
