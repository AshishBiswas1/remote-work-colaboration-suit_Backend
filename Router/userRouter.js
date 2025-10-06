const express = require('express');
const { signup, login, protect, restrictTo } = require('../controller/authController');
const { 
    getAllUsers, 
    getUser, 
    createUser, 
    updateUser, 
    deleteUser 
} = require('../controller/userController');

const router = express.Router();

// User authentication routes
router.route('/signup').post(signup);
router.route('/login').post(login);

// Route accessable only to admin
router.use(protect, restrictTo('admin'));

// User CRUD routes
router.route('/')
    .get(getAllUsers)
    .post(createUser);

router.route('/:id')
    .get(getUser)
    .patch(updateUser)
    .delete(deleteUser);

module.exports = router;
