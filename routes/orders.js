const express = require('express')
const router = express.Router()
const result = require('../utils/result')
const pool = require('../utils/db')
const { read } = require('fs')

// get all orders for restaurants owner
router.get('/orders' , (req , res) => {
    const user_id = req.headers.user_id
    console.log(user_id)
    // get restaurant for this owner 
    const sql = `select restaurant_id from restaurants where user_id = ?`
    pool.query(sql , [ user_id ] , (err , data) => {
        if(err) {
            res.send(result.createResult(err , null))
        } else if(data.length == 0) {
            res.send(result.createResult(`No restaurant found for this owner`))
        } else {
            const restaurant_id = data[0].restaurant_id
            // get all orders
            const getOrdersSql = `select * from orders where restaurant_id = ?` 
            pool.query(getOrdersSql , [ restaurant_id ] , (err , data) => {
                if(err) {
                    res.send(result.createResult(err , null))
                } else if(data.length == 0) {
                    res.send(result.createResult("Orders are not available"))
                } else {
                    res.send(result.createResult(null , data))
                }
            })
        }
    })
})


// update status 
// state transition -> finite state of transition 
router.put('/orders/:order_id/status' , (req, res) => {
    const user_id = req.headers.user_id
    const order_id = req.params.order_id
    const { status : newStatus} = req.body

    //transition flow -> it prevents from invalid jumps 
    const flow = {
        pending : ['confirmed' , 'cancelled'] , 
        confirmed : ['preparing' , 'cancelled'] , 
        preparing : ['out_for_delivery'] , 
        out_for_delivery : ['deliverd'], 
        delivered : [] ,
        cancelled : []
    }

    // get restaurant owned for this users
    const sql = `select restaurant_id from restaurants where user_id = ?`
    pool.query(sql , [ user_id ] , (err , data) => {
        if(err) {
            res.send(result.createResult(err ,  null))
        } else if(data.length == 0) {
            res.send(result.createResult("No restaurant found for this owner"))
        } else {
            const restaurant_id = data[0].restaurant_id

            // get current status
            const getStatus = `select order_status from orders where order_id = ? and restaurant_id = ?`
            pool.query(getStatus , [ order_id , restaurant_id ] , (err ,orders) => {
                if(err) {
                    res.send(result.createResult(err , null))
                } else if(orders.length == 0){
                    return res.send(result.createResult("Order not found" , null))
                } 
                    
                const currentStatus = orders[0].order_status                    
                const allowedNextStatuses = flow[currentStatus]
                if(!allowedNextStatuses.includes(newStatus)){
                    return res.send(result.createResult(`Cannot change status from ${currentStatus} to ${newStatus}`, null))
                }
                // update status

                const updateStatus = ` update orders set order_status = ? where order_id = ? and restaurant_id = ?`
                pool.query(updateStatus , [ newStatus , order_id , restaurant_id ] , (err , data) => {
                    if(err) {
                        res.send(result.createResult(err ,null))
                    } else {
                        res.send(result.createResult(`Order moved from ${currentStatus} to ${newStatus}`))
                    }
                })
            })
        }
    })
})


module.exports = router