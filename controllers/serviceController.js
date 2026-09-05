import Service from '../models/Service.js';
import { logAudit } from '../services/auditService.js';

// ── Public / User: Fetch all active services (or all for master admin) ───────
export const getServices = async (req, res) => {
  try {
    const { category, search, status } = req.query;
    const query = {};

    // By default, if not explicitly querying all statuses, return active ones
    if (status) {
      query.status = status;
    } else if (!req.user || req.user.role !== 'master_admin') {
      query.status = 'active';
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { location: searchRegex },
        { tagline: searchRegex },
        { 'restaurantDetails.cuisineTypes': searchRegex },
        { 'transportDetails.driverName': searchRegex },
        { 'transportDetails.standLocation': searchRegex },
      ];
    }

    const services = await Service.find(query).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch services directory' });
  }
};

// ── Get Single Service by ID ────────────────────────────────────────────────
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error('Error fetching service by ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch service details' });
  }
};

// ── Master Admin: Create New Service ────────────────────────────────────────
export const createService = async (req, res) => {
  try {
    const {
      category,
      name,
      tagline,
      description,
      phone,
      whatsapp,
      location,
      googleMapsUrl,
      image,
      rating,
      restaurantDetails,
      transportDetails,
      stayDetails,
    } = req.body;

    if (!category || !name || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide required fields: category, name, phone, and location.',
      });
    }

    const newService = new Service({
      category,
      name,
      tagline: tagline || '',
      description: description || '',
      phone,
      whatsapp: whatsapp || phone,
      location,
      googleMapsUrl: googleMapsUrl || '',
      image: image || '',
      rating: Number(rating) || 4.8,
      status: 'active',
      restaurantDetails: restaurantDetails || {},
      transportDetails: transportDetails || {},
      stayDetails: stayDetails || {},
    });

    await newService.save();

    // Audit log
    await logAudit({
      performedBy: req.user?._id,
      role: req.user?.role,
      action: 'SERVICE_CREATED',
      targetType: 'Service',
      targetId: newService._id,
      metadata: { name, category },
    });

    return res.status(201).json({
      success: true,
      message: 'Service listing created successfully',
      data: newService,
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create service' });
  }
};

// ── Master Admin: Update Service ────────────────────────────────────────────
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const service = await Service.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Audit log
    await logAudit({
      performedBy: req.user?._id,
      role: req.user?.role,
      action: 'SERVICE_UPDATED',
      targetType: 'Service',
      targetId: service._id,
      metadata: { name: service.name, category: service.category },
    });

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service,
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update service' });
  }
};

// ── Master Admin: Delete Service ────────────────────────────────────────────
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Audit log
    await logAudit({
      performedBy: req.user?._id,
      role: req.user?.role,
      action: 'SERVICE_DELETED',
      targetType: 'Service',
      targetId: service._id,
      metadata: { name: service.name, category: service.category },
    });

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete service' });
  }
};

// ── Master Admin / Restaurant: Add Food Item to Menu ────────────────────────
export const addMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, type, price, description, isAvailable, isSpecial, image } = req.body;

    if (!name || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: 'Food item name and price are required.',
      });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Restaurant service not found' });
    }

    if (service.category !== 'restaurant') {
      return res.status(400).json({ success: false, message: 'Service is not a restaurant.' });
    }

    const itemCat = (category || 'Main Course').trim();
    const newItem = {
      name: name.trim(),
      category: itemCat,
      type: type || 'non-veg',
      price: Number(price),
      description: description || '',
      image: image || '',
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      isSpecial: isSpecial !== undefined ? Boolean(isSpecial) : false,
    };

    if (!service.restaurantDetails) {
      service.restaurantDetails = { menuItems: [], categories: [] };
    }
    if (!service.restaurantDetails.categories) {
      service.restaurantDetails.categories = ['Main Course', 'Starters', 'Seafood Specials', 'Breads & Rice', 'Snacks & Quick Bites', 'Desserts', 'Beverages'];
    }
    if (itemCat && !service.restaurantDetails.categories.includes(itemCat)) {
      service.restaurantDetails.categories.push(itemCat);
    }
    service.restaurantDetails.menuItems.push(newItem);

    await service.save();

    return res.status(201).json({
      success: true,
      message: 'Food item added to menu successfully',
      data: service,
    });
  } catch (error) {
    console.error('Error adding menu item:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to add food item' });
  }
};

// ── Master Admin / Restaurant: Update Food Item ─────────────────────────────
export const updateMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const updateFields = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const menuItem = service.restaurantDetails?.menuItems?.id(itemId);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Apply updates
    if (updateFields.name !== undefined) menuItem.name = updateFields.name;
    if (updateFields.category !== undefined) {
      const updatedCat = String(updateFields.category).trim();
      menuItem.category = updatedCat;
      if (!service.restaurantDetails.categories) {
        service.restaurantDetails.categories = ['Main Course', 'Starters', 'Seafood Specials', 'Breads & Rice', 'Snacks & Quick Bites', 'Desserts', 'Beverages'];
      }
      if (updatedCat && !service.restaurantDetails.categories.includes(updatedCat)) {
        service.restaurantDetails.categories.push(updatedCat);
      }
    }
    if (updateFields.type !== undefined) menuItem.type = updateFields.type;
    if (updateFields.price !== undefined) menuItem.price = Number(updateFields.price);
    if (updateFields.description !== undefined) menuItem.description = updateFields.description;
    if (updateFields.image !== undefined) menuItem.image = updateFields.image;
    if (updateFields.isAvailable !== undefined) menuItem.isAvailable = Boolean(updateFields.isAvailable);
    if (updateFields.isSpecial !== undefined) menuItem.isSpecial = Boolean(updateFields.isSpecial);

    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      data: service,
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update food item' });
  }
};

// ── Instant 1-Click Toggle: Food Item Availability (In Stock / Sold Out) ────
export const toggleMenuItemAvailability = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const menuItem = service.restaurantDetails?.menuItems?.id(itemId);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    menuItem.isAvailable = !menuItem.isAvailable;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Item marked as ${menuItem.isAvailable ? 'Available' : 'Sold Out'}`,
      isAvailable: menuItem.isAvailable,
      data: service,
    });
  } catch (error) {
    console.error('Error toggling menu item availability:', error);
    return res.status(500).json({ success: false, message: 'Failed to update item availability' });
  }
};

// ── Master Admin: Delete Food Item from Menu ────────────────────────────────
export const deleteMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (service.restaurantDetails?.menuItems) {
      service.restaurantDetails.menuItems.pull({ _id: itemId });
      await service.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully',
      data: service,
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete food item' });
  }
};
