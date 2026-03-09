// only user with role = 'restaurant_owner' are only allowed to add row into restaurant .
const express = require('express')
const router = express.Router()
const pool = require('../utils/db')
const result = require('../utils/result')
const config = require('../utils/config')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const upload = multer({dest : 'categoryImages'}) // files can be stored in upload -> multer instance if{destination} storage is not store
                                    // multer adds body object and file(s) can be request object -> means - 
                                    // multer reads incoming HTTP request 
                                    // extract them in data + file 
                                    // and attach them in req so your routes can easily use them 
                                    // requests can be parsed by multer 
                                    // files can be stored in uploads 
                                    // multer can handle multipart/form-data, and files can be accessed via req.file
                                    
// all file system operations are synchroneous, callback, and promise based forms. are accessible by both commonJs syntax and ES6 module 
const path = require('path')
const fs = require('fs')


// register to restaurant only when users role is [restaurant_owner],
// while user is logged in into system he tries to create an new restaurant account but he/she first needs
// to authorize his identity(who are you) or (what are you allowd to do) if his/her role is [restaurant_owner] then and only then he able to create/register in 
// restaurant otherwise error -> Your role is ---. You are not authorized.


// register restaurant owner + restaurant
router.post('/register' , (req, res) => {
    const { full_name , email , password , name , cuisine_type , contact_number , address , open_time , close_time } = req.body
    const sql = `select user_id from users where email = ?` 
    pool.query(sql , email , (err , data) => {
        if(err) {
            res.send(result.createResult(err ,null))
        } else if(data.length > 0) {
            res.send(result.createResult("This email is already registered, please log in instead"))
        } else {
            // hashed pass
            bcrypt.hash(password , config.SALT_ROUND , (err , hashedPass) => {
                if(hashedPass) {
                    // insert user as restaurant_owner
                    const insertUser = `insert into users(full_name , email , password , phone , role) values (? , ? , ? , ? , ?)`
                    pool.query(insertUser , [full_name , email , hashedPass , contact_number , 'restaurant_owner'] , (err , data) =>{
                        if(err) {
                            if(err.code === 'ER_DUP_ENTRY') {
                                if(err.message.includes('phone')) {
                                    res.send(result.createResult('Phone number is already exits'))
                                } else {
                                    res.send(result.createResult(err , null))
                                }
                            }
                            
                        } else {
                            // insert restaurant_owner
                            const userId = `select user_id from users where email = ?`
                            pool.query(userId , [ email ] , (err , data) => { 
                                if(err) {
                                    res.send(result.createResult(err , null))
                                } else {
                                    const user_id = data[0].user_id
                                    const restInsert = `insert into restaurants(user_id , name , cuisine_type , contact_number , address , open_time , close_time) values (? , ? , ? , ? , ? , ? , ?)`
                                    pool.query(restInsert , [ user_id , name , cuisine_type , contact_number , address , open_time , close_time ] , (err , data) => {
                                        if(err) {
                                            res.send(result.createResult(err ,  null))
                                        } else {
                                            res.send(result.createResult(null , {
                                                user_id ,
                                                restaurant_id : data.insertId
                                            }))
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    })
})

// sign in restaurants  
router.post('/signin', (req, res) => {

    const { email, password } = req.body
    const sql = `
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.password,
            u.role,
            r.restaurant_id,
            r.name AS restaurant_name,
            r.verification_status,
            r.rating ,
            r.cuisine_type
        FROM users u
        INNER JOIN restaurants r
            ON u.user_id = r.user_id
        WHERE u.email = ?
          AND u.role = 'restaurant_owner'       
    `

    pool.query(sql, [email], async (err, rows) => {
        if (err) {
            res.send(result.createResult(err, null))
        }

        if (!rows ||rows.length === 0) {
           res.send(result.createResult("You are not authorized to access the restaurant portal" , null))
        }

        const user = rows[0]
        bcrypt.compare(password , user.password , (err , hashedPass) => {
            if(hashedPass) {
                const payload = {
                    user_id: user.user_id, 
                    role: user.role,
                    restaurant_id: user.restaurant_id // Added for order/menu queries
                }

                const token = jwt.sign(payload ,config.secret,{ expiresIn: '1d' })
                res.send(
                    result.createResult(null, {
                        token,
                        user: {
                            user_id: user.user_id,
                            full_name: user.full_name,
                            email: user.email,
                            role: user.role
                        },
                        restaurant: {
                            restaurant_id: user.restaurant_id,
                            name: user.restaurant_name,
                            rating: user.rating,
                            status: user.status ,
                            cuisine_type : user.cuisine_type
                        }
                    })
                )
            } else {
                res.send(result.createResult("Invalid email and password"))
            }
        })
    })
})


// add restaurant categories 
router.post('/categories' , upload.single('image_url') ,  (req, res) => {
    const user_id = req.headers.user_id
    const { category_name , description } = req.body
    
    // 1.validate file exits ( if user doesnt send file(image))
    if(!req.file) {
        return res.send(result.createResult("Category image is required" ,null))
    } 
    // 2. validate image type
    const ext = path.extname(req.file.originalname).toLowerCase()
    // file(images) uploading 
    const allowedType = ['.jpg' , '.jpeg' , '.png']
    if(!allowedType.includes(ext)) {
        fs.unlinkSync(req.file.path)
        res.send(result.createResult("Invalid image type" , null))
    }

    // 3. rename file
    // upload this image_url on database 
    const image_url = req.file.filename + ext
    // rename uploaded file on express server with an extension
    const oldname = req.file.path
    const newname = oldname + ext
    fs.rename(oldname , newname ,(err) => { })
    // 4. Insert DB record
    const sql = `insert into categories( category_name , description , image_url ) values ( ? , ? , ? )`
    pool.query(sql , [ category_name , description , image_url ] , (err , data) => {
        if(err) {
            if(err.code === 'ER_DUP_ENTRY') {
                // detect which field caused dulplication
                if(err.message.includes('category_name')){
                    res.send(result.createResult("Category name is already exists"))
                }  
            }
        } else {
            // 5. send one response 
            res.send(result.createResult(null , data)) 
        }
    })
})

// Middleware to extract and verify JWT Token for subsequent routes
const authenticateToken = (req, res, next) => {
    const token = req.headers['token']
    if (!token) return res.send(result.createResult("Unauthorized - Token missing", null))

    jwt.verify(token, config.secret, (err, decoded) => {
        if (err) return res.send(result.createResult("Invalid Token", null))
        req.user = decoded
        next()
    })
}

// restaurant-categories-status
router.get('/profile' , authenticateToken, (req , res) =>{
    // Use user_id from token
    const user_id = req.user.user_id
    const sql = `
                select 
                u.full_name as name, 
                u.email , 
                u.phone , 
                u.status ,
                r.name as restaurant_name , 
                r.cuisine_type , 
                r.address , 
                r.verification_status , 
                r.rating , 
                r.open_time , 
                r.close_time
                from users u 
                inner join 
                restaurants r on 
                u.user_id = r.user_id 
                where u.user_id = ? 
                `
    pool.query(sql , user_id , (err , data) => {
        if(err) {
            res.send(result.createResult(err , null))
        } else if (data.length === 0) {
            res.send(result.createResult("Profile not found", null))
        } else {
            res.send(result.createResult(null , data[0]))
        }
    })
}) 

// restaurants-update-profile
router.patch('/' , authenticateToken, (req, res) => {
    // Use user_id from token
    const user_id = req.user.user_id 
    const { full_name , phone , name , cuisine_type , address , open_time , close_time } = req.body
    const sql = `
                update users u join restaurants r 
                on u.user_id = r.user_id 
                set 
                u.full_name = ? , 
                u.phone = ? , 
                r.name = ? , 
                r.cuisine_type = ? , 
                r.contact_number = ? , 
                r.address = ? , 
                r.open_time = ? , 
                r.close_time = ? 
                where u.user_id =  ?
                `
    pool.query(sql , [ full_name , phone , name , cuisine_type ,phone ,  address , open_time , close_time , user_id] , (err , data) => {
        if(err) {
            res.send(result.createResult(err , null))
        } else {
            res.send(result.createResult(null , "Profile updated successfully"))
        }
    })
})


// ==========================================
// NEW: MENU & ORDER ROUTES FOR REACT NATIVE
// ==========================================

// 1. GET RESTAURANT MENU ITEMS
router.get('/getmenus', authenticateToken, (req, res) => {
    const restaurant_id = req.user.restaurant_id
    const sql = `SELECT * FROM menu_items WHERE restaurant_id = ?`
    
    pool.query(sql, [restaurant_id], (err, data) => {
        if(err) return res.send(result.createResult(err, null))
        res.send(result.createResult(null, data))
    })
})

// 2. ADD MENU ITEM
const menuUpload = multer({ dest: 'menuItemsImages' })
router.post('/addmenus', authenticateToken, menuUpload.single('image_url'), (req, res) => {
    const restaurant_id = req.user.restaurant_id
    const { name, description, price, isAvailable, category_id } = req.body
    
    if(!req.file) {
        return res.send(result.createResult("Menu image is required", null))
    }
    
    const ext = path.extname(req.file.originalname).toLowerCase()
    const allowedType = ['.jpg' , '.jpeg' , '.png']
    if(!allowedType.includes(ext)) {
        fs.unlinkSync(req.file.path)
        return res.send(result.createResult("Invalid image type", null))
    }
    
    const image_url = req.file.filename + ext
    const oldname = req.file.path
    const newname = oldname + ext
    fs.renameSync(oldname, newname)
    
    // Default values if missing
    const isAvail = (isAvailable === 'true' || isAvailable === '1' || isAvailable === true) ? 1 : 0
    const catId = category_id || 1 // Fallback category if none provided
    
    const sql = `INSERT INTO menu_items(restaurant_id, category_id, name, description, price, image_url, availability) VALUES (?, ?, ?, ?, ?, ?, ?)`
    
    pool.query(sql, [restaurant_id, catId, name, description, price, image_url, isAvail], (err, data) => {
        if(err) return res.send(result.createResult(err, null))
        res.send(result.createResult(null, { message: "Menu item added", item_id: data.insertId }))
    })
})

// 3. DELETE MENU ITEM
router.delete('/:itemId', authenticateToken, (req, res) => {
    const restaurant_id = req.user.restaurant_id
    const { itemId } = req.params
    
    const sql = `DELETE FROM menu_items WHERE item_id = ? AND restaurant_id = ?`
    
    pool.query(sql, [itemId, restaurant_id], (err, data) => {
        if(err) return res.send(result.createResult(err, null))
        if(data.affectedRows === 0) return res.send(result.createResult("Item not found", null))
        res.send(result.createResult(null, "Menu item deleted"))
    })
})

// 4. GET ALL ORDERS FOR THIS RESTAURANT
router.get('/orders', authenticateToken, (req, res) => {
    const restaurant_id = req.user.restaurant_id
    
    const sql = `
        SELECT o.order_id, o.order_status, o.total_amount, o.order_date,
               u.full_name as customer_name
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        WHERE o.restaurant_id = ?
        ORDER BY o.order_date DESC
    `

    pool.query(sql, [restaurant_id], (err, data) => {
        if (err) return res.send(result.createResult(err, null))
        res.send(result.createResult(null, data))
    })
})

// 5. UPDATE ORDER STATUS
router.put('/orders/:order_id/status', authenticateToken, (req, res) => {
    const restaurant_id = req.user.restaurant_id
    const { status } = req.body
    const { order_id } = req.params

    if (!status) return res.send(result.createResult("Status is required", null))

    const sql = `UPDATE orders SET order_status = ? WHERE order_id = ? AND restaurant_id = ?`

    pool.query(sql, [status, order_id, restaurant_id], (err, data) => {
        if (err) return res.send(result.createResult(err, null))
        if(data.affectedRows === 0) return res.send(result.createResult("Order not found", null))
        res.send(result.createResult(null, "Order status updated to " + status))
    })
})

// get all restaurant categories
router.get('/categories', (req, res) => {
    const sql = `SELECT * FROM categories`
    pool.query(sql, (err, data) => {
        if(err) {
            res.send(result.createResult(err, null))
        } else {
            res.send(result.createResult(null, data))
        }
    })
})


module.exports = router
