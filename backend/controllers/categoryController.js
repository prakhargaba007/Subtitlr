const LessonCategory = require("../models/Category");

// Create a new category
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, color, order, type } = req.body;

    // Create category object
    const categoryData = {
      name,
      description,
      createdBy: req.userId,
      color: color || "#3498db",
    };

    // Add optional fields if they exist
    if (order !== undefined) categoryData.order = order;
    if (type) categoryData.type = type;

    // Add image URL if file was uploaded
    if (req.file) {
      categoryData.imageUrl = req.file.path.replace(/\\/g, "/");
    }

    const category = new LessonCategory(categoryData);
    await category.save();

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    console.log(err);
    if (err.code === 11000) {
      console.log("Duplicate key error", err);
      // Duplicate key error (likely the name field which has a unique constraint)
      return res.status(400).json({
        message: "A category with this name already exists",
      });
    }
    next(err);
  }
};

// Get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
    const { 
      type, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'order',
      sortOrder = 'asc'
    } = req.query;

    // Build query object
    const query = {};
    if (type) query.type = type;

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [categories, totalCount] = await Promise.all([
      LessonCategory.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      LessonCategory.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      categories,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get active categories
exports.getActiveCategories = async (req, res, next) => {
  try {
    const categories = await LessonCategory.find({ isActive: true }).sort({
      order: 1,
      name: 1,
    });

    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
};

// Get category by ID
exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await LessonCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description, isActive, order, color, type } = req.body;

    // Find category
    const category = await LessonCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Update fields
    if (name) category.name = name;
    if (description) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = order;
    if (color) category.color = color;
    if (type) category.type = type;

    // Update image if new file uploaded
    if (req.file) {
      category.imageUrl = req.file.path.replace(/\\/g, "/");
    }

    await category.save();

    res.status(200).json({
      message: "Category updated successfully",
      category,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message: "A category with this name already exists",
      });
    }
    next(err);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const result = await LessonCategory.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Toggle category active status
exports.toggleCategoryStatus = async (req, res, next) => {
  try {
    const category = await LessonCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      message: `Category ${
        category.isActive ? "activated" : "deactivated"
      } successfully`,
      category,
    });
  } catch (err) {
    next(err);
  }
};

// Get categories by type
exports.getCategoriesByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    // console.log("type", type);

    // Validate type parameter
    // const validTypes = ["binge", "course", "quiz", "lesson", "module"];
    // if (!validTypes.includes(type)) {
    //   console.log(
    //     "Invalid type parameter. Must be one of: binge, course, quiz, lesson, module"
    //   );
    //   return res.status(400).json({
    //     message:
    //       "Invalid type parameter. Must be one of: binge, course, quiz, lesson, module",
    //   });
    // }

    const categories = await LessonCategory.find({
      type,
      // isActive: req.query.activeO  nly === "true" ? true : undefined,
    }).sort({ order: 1, name: 1 });
    // console.log("categories", categories);

    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
};
