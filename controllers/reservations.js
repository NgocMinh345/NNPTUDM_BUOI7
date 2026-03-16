let reservationModel = require('../schemas/reservations')
let productModel = require('../schemas/products')
let cartModel = require('../schemas/cart')
let inventoryModel = require('../schemas/inventories')

module.exports = {
    // Lấy tất cả các reservation của user
    GetAllReservationsByUser: async function (userId) {
        return await reservationModel.find({
            user: userId
        }).populate({
            path: 'items.product',
            select: 'title price'
        }).populate('user', 'username email');
    },

    // Lấy 1 reservation theo ID của user
    GetReservationById: async function (userId, reservationId) {
        return await reservationModel.findOne({
            _id: reservationId,
            user: userId
        }).populate({
            path: 'items.product',
            select: 'title price'
        }).populate('user', 'username email');
    },

    // Reserve từ giỏ hàng của user
    ReserveACart: async function (userId, session) {
        // Lấy giỏ hàng của user
        let currentCart = await cartModel.findOne({
            user: userId
        }).populate('items.product');

        if (!currentCart || currentCart.items.length === 0) {
            throw new Error('Giỏ hàng trống');
        }

        // Tính toán thông tin từng item trong reservation
        let reservationItems = [];
        let totalAmount = 0;

        for (let item of currentCart.items) {
            let product = item.product;
            let quantity = item.quantity;
            let price = product.price;
            let subtotal = price * quantity;

            reservationItems.push({
                product: product._id,
                quantity: quantity,
                price: price,
                subtotal: subtotal
            });

            totalAmount += subtotal;

            // Kiểm tra và trừ inventory
            let inventory = await inventoryModel.findOne({
                product: product._id
            }).session(session);

            if (!inventory || inventory.stock < quantity) {
                throw new Error(`Sản phẩm ${product.title} không đủ hàng`);
            }

            inventory.stock -= quantity;
            await inventory.save({ session });
        }

        // Kiểm tra xem user đã có reservation chưa
        let existingReservation = await reservationModel.findOne({
            user: userId
        }).session(session);

        let reservation;
        if (existingReservation) {
            // Update reservation hiện tại
            existingReservation.items = reservationItems;
            existingReservation.totalAmount = totalAmount;
            existingReservation.status = 'actived';
            existingReservation.ExpiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h hết hạn
            reservation = await existingReservation.save({ session });
        } else {
            // Tạo reservation mới
            let newReservation = new reservationModel({
                user: userId,
                items: reservationItems,
                totalAmount: totalAmount,
                status: 'actived',
                ExpiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });
            reservation = await newReservation.save({ session });
        }

        // Xóa items khỏi giỏ hàng
        currentCart.items = [];
        await currentCart.save({ session });

        return reservation;
    },

    // Reserve items cụ thể từ body request {items: [{product, quantity}, ...]}
    ReserveItems: async function (userId, items, session) {
        if (!items || items.length === 0) {
            throw new Error('Danh sách sản phẩm trống');
        }

        let reservationItems = [];
        let totalAmount = 0;

        for (let item of items) {
            let product = await productModel.findById(item.product).session(session);

            if (!product) {
                throw new Error(`Sản phẩm không tồn tại`);
            }

            let quantity = item.quantity;
            let price = product.price;
            let subtotal = price * quantity;

            reservationItems.push({
                product: product._id,
                quantity: quantity,
                price: price,
                subtotal: subtotal
            });

            totalAmount += subtotal;

            // Kiểm tra và trừ inventory
            let inventory = await inventoryModel.findOne({
                product: product._id
            }).session(session);

            if (!inventory || inventory.stock < quantity) {
                throw new Error(`Sản phẩm ${product.title} không đủ hàng`);
            }

            inventory.stock -= quantity;
            await inventory.save({ session });
        }

        // Kiểm tra xem user đã có reservation chưa
        let existingReservation = await reservationModel.findOne({
            user: userId
        }).session(session);

        let reservation;
        if (existingReservation) {
            // Update reservation hiện tại
            existingReservation.items = reservationItems;
            existingReservation.totalAmount = totalAmount;
            existingReservation.status = 'actived';
            existingReservation.ExpiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h hết hạn
            reservation = await existingReservation.save({ session });
        } else {
            // Tạo reservation mới
            let newReservation = new reservationModel({
                user: userId,
                items: reservationItems,
                totalAmount: totalAmount,
                status: 'actived',
                ExpiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });
            reservation = await newReservation.save({ session });
        }

        return reservation;
    },

    // Cancel reservation - phải trong transaction
    CancelReserve: async function (userId, reservationId, session) {
        let reservation = await reservationModel.findOne({
            _id: reservationId,
            user: userId
        }).session(session);

        if (!reservation) {
            throw new Error('Reservation không tồn tại');
        }

        if (reservation.status === 'cancelled') {
            throw new Error('Reservation đã bị hủy rồi');
        }

        // Hoàn lại inventory
        for (let item of reservation.items) {
            let inventory = await inventoryModel.findOne({
                product: item.product
            }).session(session);

            if (inventory) {
                inventory.stock += item.quantity;
                await inventory.save({ session });
            }
        }

        // Cập nhật status thành cancelled
        reservation.status = 'cancelled';
        reservation = await reservation.save({ session });

        return reservation;
    }
}
