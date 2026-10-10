import { handleApi } from '../../server/api';
import type { FunctionContext } from '../../server/platform';
export const onRequest = (context: FunctionContext) => handleApi(context);
