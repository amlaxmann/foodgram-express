const express = require('express')
const bcrypt = require('bcrypt')
const router = express.Router()
const result = require('../utils/result')
const pool = require('../utils/db')
const config = require('../utils/config')
const jwt = require('jsonwebtoken')


// ========================================
// AUTHENTICATION ROUTES
// ========================================

// 1️⃣ SIGNUP - Register new user
router.post('/signUp', (req, res) => {
    const { full_name, email, password, phone } = req.body

    // Input validation
    if (!full_name || !email || !password || !phone) {
        return res.send(result.createResult("All fields are required", null))
    }

    const sql = `INSERT INTO users(full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`

    bcrypt.hash(password, config.SALT_ROUND, (err, hashedPass) => {
        if (err) {
            return res.send(result.createResult(err, null))
        }

        pool.query(sql, [full_name, email, hashedPass, phone, 'customer'], (err, data) => {
            if (err) {
                if (err.code == "ER_DUP_ENTRY") {
                    if (err.message.includes('email')) {
                        return res.send(result.createResult("This email is already registered. Try logging in instead.", null))
                    } else if (err.message.includes('phone')) {
                        return res.send(result.createResult("This phone number is already registered. Please use a different number.", null))
                    } else {
                        return res.send(result.createResult("Duplicate entry detected", null))
                    }
                } else {
                    return res.send(result.createResult(err.message, null))
                }
            } else {
                res.send(result.createResult(null, { message: "User registered successfully", user_id: data.insertId }))
            }
        })
    })
})


// 2️⃣ SIGNIN - Login user (FIXED: Changed from GET to POST)
router.post('/signin', (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.send(result.createResult("Email and password are required", null))
    }

    const sql = `SELECT * FROM users WHERE email = ?`

    pool.query(sql, [email], (err, data) => {
        if (err) {
            return res.send(result.createResult(err, null))
        } else if (data.length == 0) {
            return res.send(result.createResult("Invalid Email", null))
        } else {
            // Check if user is active
            if (data[0].status !== 'active') {
                return res.send(result.createResult("Account is inactive or suspended", null))
            }

            bcrypt.compare(password, data[0].password, (err, isMatch) => {
                if (err) {
                    return res.send(result.createResult(err, null))
                }

                if (isMatch) {
                    const payload = {
                        user_id: data[0].user_id
                    }
                    const token = jwt.sign(payload, config.secret)

                    const user = {
                        token,
                        full_name: data[0].full_name,
                        email: data[0].email,
                        phone: data[0].phone,
                        role: data[0].role
                    }
                    res.send(result.createResult(null, user))
                } else {
                    res.send(result.createResult("Invalid Password", null))
                }
            })
        }
    })
})


// ========================================
// ADDRESS MANAGEMENT
// ========================================

// 3️⃣ ADD ADDRESS
router.post('/address', (req, res) => {
    const user_id = req.headers.user_id
    const { address_line, city, state, pincode, label } = req.body

    if (!address_line || !city || !state || !pincode) {
        return res.send(result.createResult("All address fields are required", null))
    }

    const sql = `INSERT INTO user_addresses(address_line, user_id, city, state, pincode, label) VALUES (?, ?, ?, ?, ?, ?)`

    pool.query(sql, [address_line, user_id, city, state, pincode, label], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, { message: "Address added successfully", address_id: data.insertId }))
        }
    })
})


// 4️⃣ GET USER ADDRESSES (NEW - Frontend expects this)
router.get('/address', (req, res) => {
    const user_id = req.headers.user_id
    const sql = `SELECT * FROM user_addresses WHERE user_id = ?`

    pool.query(sql, [user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// 5️⃣ UPDATE ADDRESS (NEW - Frontend expects this)
router.put('/address', (req, res) => {
    const user_id = req.headers.user_id
    const { address_id, address_line, city, state, pincode, label } = req.body

    if (!address_id) {
        return res.send(result.createResult("Address ID is required", null))
    }

    const sql = `UPDATE user_addresses SET address_line = ?, city = ?, state = ?, pincode = ?, label = ? WHERE address_id = ? AND user_id = ?`

    pool.query(sql, [address_line, city, state, pincode, label, address_id, user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else if (data.affectedRows === 0) {
            res.send(result.createResult("Address not found or unauthorized", null))
        } else {
            res.send(result.createResult(null, { message: "Address updated successfully" }))
        }
    })
})


// 6️⃣ DELETE ADDRESS
router.delete('/address', (req, res) => {
    const user_id = req.headers.user_id
    const { address_id } = req.body

    if (!address_id) {
        return res.send(result.createResult("Address ID is required", null))
    }

    const sql = `DELETE FROM user_addresses WHERE address_id = ? AND user_id = ?`

    pool.query(sql, [address_id, user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else if (data.affectedRows === 0) {
            res.send(result.createResult("Address not found or unauthorized", null))
        } else {
            res.send(result.createResult(null, { message: "Address deleted successfully" }))
        }
    })
})


// ========================================
// RESTAURANT & MENU
// ========================================

// 7️⃣ GET ALL RESTAURANTS (FIXED: Renamed to match frontend)
router.get('/restaurant', (req, res) => {
    const sql = `SELECT * FROM restaurants WHERE verification_status = 'verified'`

    pool.query(sql, (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// 8️⃣ GET CATEGORIES (NEW - Frontend expects this)
router.get('/categories', (req, res) => {
    const sql = `SELECT * FROM categories WHERE status = 'active'`

    pool.query(sql, (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// 9️⃣ GET MENU ITEMS (FIXED: Use query params, renamed to match frontend)
router.get('/menuItems', (req, res) => {
    const { restaurant_id } = req.query

    if (!restaurant_id) {
        return res.send(result.createResult("Restaurant ID is required", null))
    }

    const sql = `SELECT * FROM menu_items WHERE restaurant_id = ? AND availability = 1`

    pool.query(sql, [restaurant_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// 🔟 GET RESTAURANT COUPONS (FIXED: Use query params)
router.get('/coupons', (req, res) => {
    const { restaurant_id } = req.query

    if (!restaurant_id) {
        return res.send(result.createResult("Restaurant ID is required", null))
    }

    const sql = `SELECT * FROM coupons WHERE restaurant_id = ? AND valid_to >= CURDATE()`

    pool.query(sql, [restaurant_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// ========================================
// CART MANAGEMENT
// ========================================

// 1️⃣1️⃣ CREATE CART (NEW)
router.post('/cart', (req, res) => {
    const user_id = req.headers.user_id

    // Check if user already has an active cart
    const checkSql = `SELECT cart_id FROM carts WHERE user_id = ? AND status = 'active'`

    pool.query(checkSql, [user_id], (err, data) => {
        if (err) {
            return res.send(result.createResult(err, null))
        }

        if (data.length > 0) {
            // User already has active cart
            return res.send(result.createResult(null, { cart_id: data[0].cart_id, message: "Active cart already exists" }))
        } else {
            // Create new cart
            const insertSql = `INSERT INTO carts(user_id, status) VALUES (?, 'active')`
            pool.query(insertSql, [user_id], (err, data) => {
                if (err) {
                    res.send(result.createResult(err, null))
                } else {
                    res.send(result.createResult(null, { cart_id: data.insertId, message: "Cart created successfully" }))
                }
            })
        }
    })
})


// 1️⃣2️⃣ ADD ITEM TO CART (NEW)
router.post('/cart/item', (req, res) => {
    const user_id = req.headers.user_id
    const { item_id, quantity } = req.body

    if (!item_id || !quantity) {
        return res.send(result.createResult("Item ID and quantity are required", null))
    }

    // Get or create active cart
    const getCartSql = `SELECT cart_id FROM carts WHERE user_id = ? AND status = 'active'`

    pool.query(getCartSql, [user_id], (err, cartData) => {
        if (err) {
            return res.send(result.createResult(err, null))
        }

        let cart_id

        const addToCart = (cart_id) => {
            // Check if item already in cart
            const checkItemSql = `SELECT * FROM cart_items WHERE cart_id = ? AND item_id = ?`
            pool.query(checkItemSql, [cart_id, item_id], (err, itemData) => {
                if (err) {
                    return res.send(result.createResult(err, null))
                }

                if (itemData.length > 0) {
                    // Update quantity
                    const updateSql = `UPDATE cart_items SET quantity = quantity + ? WHERE cart_id = ? AND item_id = ?`
                    pool.query(updateSql, [quantity, cart_id, item_id], (err, data) => {
                        if (err) {
                            res.send(result.createResult(err, null))
                        } else {
                            res.send(result.createResult(null, { message: "Cart item quantity updated" }))
                        }
                    })
                } else {
                    // Insert new item
                    const insertSql = `INSERT INTO cart_items(cart_id, item_id, quantity) VALUES (?, ?, ?)`
                    pool.query(insertSql, [cart_id, item_id, quantity], (err, data) => {
                        if (err) {
                            res.send(result.createResult(err, null))
                        } else {
                            res.send(result.createResult(null, { message: "Item added to cart", cart_item_id: data.insertId }))
                        }
                    })
                }
            })
        }

        if (cartData.length > 0) {
            addToCart(cartData[0].cart_id)
        } else {
            // Create cart first
            const createCartSql = `INSERT INTO carts(user_id, status) VALUES (?, 'active')`
            pool.query(createCartSql, [user_id], (err, newCartData) => {
                if (err) {
                    return res.send(result.createResult(err, null))
                }
                addToCart(newCartData.insertId)
            })
        }
    })
})


// 1️⃣3️⃣ GET CART ITEMS (NEW - FIXED: Changed to GET method)
router.get('/getcart', (req, res) => {
    const user_id = req.headers.user_id

    const sql = `
        SELECT c.cart_id, ci.cart_item_id, ci.item_id, ci.quantity, 
               m.name, m.description, m.price, m.image_url, m.restaurant_id
        FROM carts c
        JOIN cart_items ci ON c.cart_id = ci.cart_id
        JOIN menu_items m ON ci.item_id = m.item_id
        WHERE c.user_id = ? AND c.status = 'active'
    `

    pool.query(sql, [user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// 1️⃣4️⃣ UPDATE CART ITEM QUANTITY (NEW)
router.put('/cart/item', (req, res) => {
    const user_id = req.headers.user_id
    const { cart_item_id, quantity } = req.body

    if (!cart_item_id || !quantity) {
        return res.send(result.createResult("Cart item ID and quantity are required", null))
    }

    if (quantity < 1) {
        return res.send(result.createResult("Quantity must be at least 1", null))
    }

    const sql = `
        UPDATE cart_items ci
        JOIN carts c ON ci.cart_id = c.cart_id
        SET ci.quantity = ?
        WHERE ci.cart_item_id = ? AND c.user_id = ? AND c.status = 'active'
    `

    pool.query(sql, [quantity, cart_item_id, user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else if (data.affectedRows === 0) {
            res.send(result.createResult("Cart item not found or unauthorized", null))
        } else {
            res.send(result.createResult(null, { message: "Cart item updated successfully" }))
        }
    })
})


// 1️⃣5️⃣ DELETE CART ITEM (FIXED: Added proper validation)
router.delete('/cart/item', (req, res) => {
    const user_id = req.headers.user_id
    const { cart_item_id } = req.body

    if (!cart_item_id) {
        return res.send(result.createResult("Cart item ID is required", null))
    }

    const sql = `
        DELETE ci FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.cart_id
        WHERE ci.cart_item_id = ? AND c.user_id = ? AND c.status = 'active'
    `

    pool.query(sql, [cart_item_id, user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else if (data.affectedRows === 0) {
            res.send(result.createResult("Cart item not found or unauthorized", null))
        } else {
            res.send(result.createResult(null, { message: "Cart item deleted successfully" }))
        }
    })
})


// ========================================
// ORDER MANAGEMENT
// ========================================

// 1️⃣6️⃣ PLACE ORDER (NEW - Complete order with multiple items)
router.post('/order', (req, res) => {
    const user_id = req.headers.user_id
    const { restaurant_id, address_id, items } = req.body

    // Validate input
    if (!restaurant_id || !address_id || !items || items.length === 0) {
        return res.send(result.createResult("Restaurant ID, address ID, and items are required", null))
    }

    // Calculate total amount
    let total_amount = 0
    items.forEach(item => {
        total_amount += item.price * item.quantity
    })

    // Insert order
    const orderSql = `INSERT INTO orders(user_id, restaurant_id, address_id, total_amount, order_status) VALUES (?, ?, ?, ?, 'pending')`

    pool.query(orderSql, [user_id, restaurant_id, address_id, total_amount], (err, orderData) => {
        if (err) {
            return res.send(result.createResult(err, null))
        }

        const order_id = orderData.insertId

        // Insert order items
        let itemsInserted = 0
        let insertError = null

        items.forEach(item => {
            const itemSql = `INSERT INTO order_items(order_id, item_id, quantity, price) VALUES (?, ?, ?, ?)`
            pool.query(itemSql, [order_id, item.item_id, item.quantity, item.price], (err) => {
                if (err && !insertError) {
                    insertError = err
                }
                itemsInserted++

                if (itemsInserted === items.length) {
                    if (insertError) {
                        res.send(result.createResult(insertError, null))
                    } else {
                        // Clear user's cart after successful order
                        const clearCartSql = `UPDATE carts SET status = 'checked_out' WHERE user_id = ? AND status = 'active'`
                        pool.query(clearCartSql, [user_id], () => {
                            res.send(result.createResult(null, {
                                message: "Order placed successfully",
                                order_id: order_id,
                                total_amount: total_amount
                            }))
                        })
                    }
                }
            })
        })
    })
})


// 1️⃣7️⃣ GET MY ORDERS (NEW - Frontend expects this)
router.get('/myorders', (req, res) => {
    const user_id = req.headers.user_id

    const sql = `
        SELECT o.order_id, o.restaurant_id, r.name as restaurant_name, 
               o.order_status, o.total_amount, o.order_date,
               a.address_line, a.city, a.state
        FROM orders o
        JOIN restaurants r ON o.restaurant_id = r.restaurant_id
        JOIN user_addresses a ON o.address_id = a.address_id
        WHERE o.user_id = ?
        ORDER BY o.order_date DESC
    `

    pool.query(sql, [user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


// ========================================
// PAYMENT MANAGEMENT
// ========================================

// 1️⃣8️⃣ MAKE PAYMENT (NEW)
router.post('/payment', (req, res) => {
    const user_id = req.headers.user_id
    const { order_id, payment_method, amount } = req.body

    if (!order_id || !payment_method || !amount) {
        return res.send(result.createResult("Order ID, payment method, and amount are required", null))
    }

    // Verify order belongs to user
    const verifyOrderSql = `SELECT * FROM orders WHERE order_id = ? AND user_id = ?`

    pool.query(verifyOrderSql, [order_id, user_id], (err, orderData) => {
        if (err) {
            return res.send(result.createResult(err, null))
        }

        if (orderData.length === 0) {
            return res.send(result.createResult("Order not found or unauthorized", null))
        }

        // Insert payment
        const paymentSql = `INSERT INTO payments(user_id, order_id, payment_method, payment_status, amount) VALUES (?, ?, ?, 'completed', ?)`

        pool.query(paymentSql, [user_id, order_id, payment_method, amount], (err, paymentData) => {
            if (err) {
                return res.send(result.createResult(err, null))
            }

            // Update order status
            const updateOrderSql = `UPDATE orders SET order_status = 'confirmed', payment_id = ? WHERE order_id = ?`
            pool.query(updateOrderSql, [paymentData.insertId, order_id], (err) => {
                if (err) {
                    return res.send(result.createResult(err, null))
                }

                res.send(result.createResult(null, {
                    message: "Payment processed successfully",
                    payment_id: paymentData.insertId
                }))
            })
        })
    })
})


// ========================================
// REVIEWS & RATINGS
// ========================================

// 1️⃣9️⃣ POST REVIEW (FIXED: Removed created_at, let DB handle timestamp)
router.post('/review', (req, res) => {
    const user_id = req.headers.user_id
    const { restaurant_id, item_id, delivery_person_id, rating, comment } = req.body

    if (!rating) {
        return res.send(result.createResult("Rating is required", null))
    }

    if (rating < 0 || rating > 5) {
        return res.send(result.createResult("Rating must be between 0 and 5", null))
    }

    const sql = `INSERT INTO reviews(user_id, restaurant_id, item_id, delivery_person_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)`

    pool.query(sql, [user_id, restaurant_id, item_id, delivery_person_id, rating, comment], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, { message: "Review submitted successfully", review_id: data.insertId }))
        }
    })
})


// 2️⃣0️⃣ GET REVIEWS (FIXED: Changed to POST to match frontend)
router.post('/getreview', (req, res) => {
    const user_id = req.headers.user_id
    const { restaurant_id, item_id } = req.body

    let sql = `SELECT * FROM reviews WHERE user_id = ?`
    let params = [user_id]

    if (restaurant_id) {
        sql += ` AND restaurant_id = ?`
        params.push(restaurant_id)
    }

    if (item_id) {
        sql += ` AND item_id = ?`
        params.push(item_id)
    }

    pool.query(sql, params, (err, data) => {
        res.send(result.createResult(err, data))
    })
})


// ========================================
// COMPLAINTS
// ========================================

// 2️⃣1️⃣ POST COMPLAINT (FIXED: Removed status and response - security issue)
router.post('/complaint', (req, res) => {
    const user_id = req.headers.user_id
    const { order_id, message } = req.body

    if (!message) {
        return res.send(result.createResult("Message is required", null))
    }

    // Verify order belongs to user if order_id is provided
    if (order_id) {
        const verifyOrderSql = `SELECT * FROM orders WHERE order_id = ? AND user_id = ?`
        pool.query(verifyOrderSql, [order_id, user_id], (err, orderData) => {
            if (err) {
                return res.send(result.createResult(err, null))
            }

            if (orderData.length === 0) {
                return res.send(result.createResult("Order not found or unauthorized", null))
            }

            insertComplaint()
        })
    } else {
        insertComplaint()
    }

    function insertComplaint() {
        const sql = `INSERT INTO complaints(user_id, order_id, message) VALUES (?, ?, ?)`
        pool.query(sql, [user_id, order_id, message], (err, data) => {
            if (err) {
                res.send(result.createResult(err, null))
            } else {
                res.send(result.createResult(null, { message: "Complaint submitted successfully", complaint_id: data.insertId }))
            }
        })
    }
})


// 2️⃣2️⃣ GET COMPLAINTS (NEW)
router.post('/getcomplaint', (req, res) => {
    const user_id = req.headers.user_id

    const sql = `SELECT * FROM complaints WHERE user_id = ? ORDER BY complaint_id DESC`

    pool.query(sql, [user_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})


// ========================================
// PROFILE MANAGEMENT
// ========================================

// 2️⃣3️⃣ UPDATE PROFILE (NEW)
router.put('/profile', (req, res) => {
    const user_id = req.headers.user_id
    const { full_name, phone } = req.body

    if (!full_name && !phone) {
        return res.send(result.createResult("At least one field (full_name or phone) is required", null))
    }

    let sql = `UPDATE users SET `
    let params = []
    let updates = []

    if (full_name) {
        updates.push(`full_name = ?`)
        params.push(full_name)
    }

    if (phone) {
        updates.push(`phone = ?`)
        params.push(phone)
    }

    sql += updates.join(', ') + ` WHERE user_id = ?`
    params.push(user_id)

    pool.query(sql, params, (err, data) => {
        if (err) {
            if (err.code == "ER_DUP_ENTRY") {
                return res.send(result.createResult("Phone number already in use", null))
            }
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, { message: "Profile updated successfully" }))
        }
    })
})


// 2️⃣4️⃣ GET USER PROFILE (NEW)
router.get('/profile', (req, res) => {
    const user_id = req.headers.user_id

    // Select specific fields for profile
    const sql = `SELECT full_name as name, email, phone, status, role FROM users WHERE user_id = ?`

    pool.query(sql, [user_id], (err, data) => {
        if (err) {
            res.send(result.createResult(err, null))
        } else if (data.length === 0) {
            res.send(result.createResult("User not found", null))
        } else {
            res.send(result.createResult(null, data[0]))
        }
    })
})

// ========================================
// ADMIN/UTILITY ROUTES
// ========================================

// 2️⃣4️⃣ GET ALL USERS (Admin only - should add role check)
router.get('/', (req, res) => {
    const sql = `SELECT user_id, full_name, email, phone, role, status, created_at FROM users`
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

module.exports = router