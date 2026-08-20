import Announcement from '../models/Announcement.js';

export const createAnnouncement = async (req, res) => {
  try {
    const { title, description, icon, targetRole, badge } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }
    const announcement = await Announcement.create({
      title,
      description,
      icon: icon || 'Sparkles',
      targetRole: targetRole || 'all',
      badge: badge || 'Coming Soon',
      isActive: true,
    });
    res.status(201).json({ success: true, data: { announcement } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnnouncementsMaster = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json({ success: true, data: { announcements } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndUpdate(id, req.body, { new: true });
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.json({ success: true, data: { announcement } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveAnnouncements = async (req, res) => {
  try {
    const { role } = req.query; // 'user' or 'admin'
    const query = { isActive: true };
    if (role && role !== 'all') {
      query.targetRole = { $in: ['all', role] };
    }
    const announcements = await Announcement.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: { announcements } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
