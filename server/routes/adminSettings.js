import {
  getAdminSystemSettings,
  SystemSettingsError,
  updateAdminSystemSettings,
} from '../services/systemSettingsService.js';

export function createAdminSettingsHandlers({ pool }) {
  async function getSettings(_req, res) {
    try {
      const settings = await getAdminSystemSettings({ pool });
      return res.json({ status: 'success', settings });
    } catch (error) {
      if (error instanceof SystemSettingsError) {
        return res.status(error.status).json({ status: 'error', message: error.message });
      }
      throw error;
    }
  }

  async function postSettings(req, res) {
    try {
      const settings = await updateAdminSystemSettings({
        pool,
        adminUserId: req.session?.user?.id,
        body: req.body,
      });
      return res.json({ status: 'success', message: 'System settings saved.', settings });
    } catch (error) {
      if (error instanceof SystemSettingsError) {
        return res.status(error.status).json({ status: 'error', message: error.message });
      }
      throw error;
    }
  }

  return { getSettings, postSettings };
}
