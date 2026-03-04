const express = require('express')
const router = express.Router()
const result = require('../utils/result')
const multer = require('multer')
const pool = require('../utils/db')
const path = require('path')
const fs = require('fs')
const upload = multer({dest : 'menuItemsImages'}) // multer instance if {destination} storage is store

// add menu item 
// 1. verify restaurant by this owner
// 2. validate category_id ( because category id taken from frontend-> categories fetched from backend, and displayed 
                        // using name in UI (option_menus) and fronted send back category_id to backend 
                        // backend still validate category_id , even if frontend send it cause front end data is never trusted .)
                        // if category_id's status is active then add menu_item otherwise decline it 
// 3. Image validation -> if owner doesnt send file(image) -> application getting crashed
                        // validate file exists
                        // validate file type 
                        // DB insert file
                        // rename it and upload on express server
// 4. Insert menu_item

router.post('/addmenus' ,upload.single('image_url') , (req ,res) => {
    const user_id = req.headers.user_id
    console.log(`user_id ${user_id}`)
    const { category_id , name , description , price } = req.body

    // 1. verify restaurant by this owner
    const sql = `select restaurant_id from restaurants where user_id = ? and verification_status = 'verified' `
    pool.query(sql , [user_id] , (err , data) => {
        if(err) {
            res.send(result.createResult(err , null))
        } else if(data.length === 0) {
            res.send(result.createResult(`No verified restaurant found for this owner` , null))
        } else {
            const restaurant_id = data[0].restaurant_id

            // 2. validate category_id
            const validateCategory = ` select category_id from categories where category_id = ? and status = 'active' `
            pool.query(validateCategory , category_id , (err , data) => {
                if(err) {
                    res.send(result.createResult(err , null))
                } else if(data.length === 0) {
                    res.send(result.createResult("Invalid Category"))
                } else {
                    
                    // 3. file handling 
                    if(!req.file) { // if user doesn't send image X application creashes  
                        return res.send(result.createResult("Category image is required" ,null))
                    }  
                    // validate image type
                    const ext = path.extname(req.file.originalname).toLowerCase()
                    const allowed = ['.jpg' , '.jpeg' , '.png']
                    if(!allowed.includes(ext)) {
                        fs.unlinkSync(req.file.path)
                        return res.send(result.createResult("Invalid image type" , null))
                    }
                    // upload image on database 
                    const image_url = req.file.filename + ext
                    //rename uploaded file on express server with extension
                    const oldname = req.file.path 
                    const newname = oldname + ext
                    fs.rename(oldname , newname , (err) => { })// end of file validation
                    //  4. insert menu_item DB
                    const insertSql = `insert into menu_items(restaurant_id , category_id , name , description , price , image_url ) values (? , ? , ? , ? , ? , ?)`
                    pool.query(insertSql , [restaurant_id , category_id , name , description ,  price , image_url ] , (err , data) => {
                        if(err) {
                            res.send(result.createResult(err , null)) 
                        } else {
                            const item_id = data.insertId
                            res.send(result.createResult(null , {
                                item_id ,
                                category_id ,
                                restaurant_id
                            }))
                        }
                    } )
                }
            })
        }
    })
})

router.get('/getmenus' , (req , res ) => {
    const user_id = req.headers.user_id
    const sql = `select restaurant_id from restaurants where user_id = ?`
    pool.query(sql , [user_id] , (err , data) => {
        if(err) {
            res.send(result.createResult(err , null))
        } else {
            const restaurant_id = data[0].restaurant_id
            const getMenuSql = `select * from menu_items where restaurant_id = ?`
            pool.query(getMenuSql , [ restaurant_id ] , (err , data) => {
                if(err) {
                    res.send(result.createResult(err , null))
                } else {
                    res.send(result.createResult(null , data))
                }
            })
        }
    })
})

// update menu_item
router.put('/:item_id' , (req , res) => {
    const user_id = req.headers.user_id
    const item_id = req.params.item_id
    const { name , price } = req.body
    // find restaurant for this owner
    const sql = ` select restaurant_id from restaurants where user_id = ? `
    pool.query(sql , [ user_id ] , (err , data) => {
        if(err) {
            res.send(result.createResult(err , data))
        } else {
            const restaurant_id = data[0].restaurant_id
            // update item (ownership enforced)
            const updateSql = ` update menu_items set name = ? , price = ? where item_id = ? and restaurant_id = ?`
            pool.query(updateSql , [ name , price , item_id , restaurant_id ] , (err , data) => {
                if(err) {
                    res.send(result.createResult(err , null))
                } else if(data.affectedRows === 0) {
                    res.send(result.createResult("Item not found or not authorized" , null))
                } else {
                    res.send(result.createResult(null , "Menu item updated successfully"))
                }
            })
        }
    })
})


module.exports = router

