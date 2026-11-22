import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UnauthorizedError } from '@pulsestack/shared';
import { env } from '../config/env';

export class AuthController {
  constructor(private authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      this.setRefreshCookie(res, result.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          organization: result.organization,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);
      this.setRefreshCookie(res, result.refreshToken);

      res.json({
        success: true,
        data: {
          user: result.user,
          organization: result.organization,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!token) {
        throw new UnauthorizedError('Refresh token required');
      }

      const result = await this.authService.refresh(token);
      this.setRefreshCookie(res, result.newRefreshToken);

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      await this.authService.logout(token);
      this.clearRefreshCookie(res);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  demo = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.demoLogin();
      this.setRefreshCookie(res, result.refreshToken);

      res.json({
        success: true,
        data: {
          user: result.user,
          organization: result.organization,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const profile = await this.authService.getCurrentUser(req.user.userId);

      res.json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  };
}
