var express = require('express');
var router = express.Router();
let reservationController = require('../controllers/reservations');
let { checkLogin } = require('../utils/authHandler.js');
const { default: mongoose } = require('mongoose');

// GET tất cả reservations của user hiện tại
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservations = await reservationController.GetAllReservationsByUser(userId);
        res.send(reservations);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// GET 1 reservation theo ID
router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservationId = req.params.id;
        let reservation = await reservationController.GetReservationById(userId, reservationId);
        
        if (!reservation) {
            return res.status(404).send({ message: 'Reservation không tồn tại' });
        }
        
        res.send(reservation);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// POST reserve giỏ hàng
router.post('/reserveACart/', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        let userId = req.userId;
        let reservation = await reservationController.ReserveACart(userId, session);
        
        await session.commitTransaction();
        session.endSession();
        
        let result = await reservation.populate({
            path: 'items.product',
            select: 'title price'
        }).populate('user', 'username email');
        
        res.send(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: err.message });
    }
});

// POST reserve items cụ thể
// Body: {
//   items: [
//     { product: "productId", quantity: 2 },
//     { product: "productId2", quantity: 3 }
//   ]
// }
router.post('/reserveItems/', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        let userId = req.userId;
        let { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).send({ 
                message: 'Body phải chứa items là một mảng' 
            });
        }
        
        let reservation = await reservationController.ReserveItems(userId, items, session);
        
        await session.commitTransaction();
        session.endSession();
        
        let result = await reservation.populate({
            path: 'items.product',
            select: 'title price'
        }).populate('user', 'username email');
        
        res.send(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: err.message });
    }
});

// POST cancel reservation
router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        let userId = req.userId;
        let reservationId = req.params.id;
        
        let reservation = await reservationController.CancelReserve(userId, reservationId, session);
        
        await session.commitTransaction();
        session.endSession();
        
        let result = await reservation.populate({
            path: 'items.product',
            select: 'title price'
        }).populate('user', 'username email');
        
        res.send(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
