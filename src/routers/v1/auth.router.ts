import express from 'express';
import { signinHandler, signupHandler } from '../../controllers/auth.controller';
import { AuthenticatedRequest, requireAuth } from '../../middlewares/auth.middleware';
import { validateRequestBody } from '../../validators';
import { signInSchema, signUpSchema } from '../../validators/auth.validator';
import { firebaseSigninHandler } from '../../controllers/firebase-auth.controller';

const authRouter = express.Router();

authRouter.post('/signup', validateRequestBody(signUpSchema), signupHandler);
authRouter.post('/signin', validateRequestBody(signInSchema), signinHandler);
authRouter.post('/firebase', firebaseSigninHandler);
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

export default authRouter;
