const express = require('express')
const cors = require('cors')

const app = express()

// ========================================
// IMPORT ROUTES & MIDDLEWARE
// ========================================

const userRouter = require('./routes/users')
const authUser = require('./auth/userAuth')
const restaurantRouter = require('./routes/restaurant') 

// ========================================
// MIDDLEWARE CONFIGURATION
// ========================================

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ========================================
// STATIC FILE SERVING
// ========================================

app.use('/categoryImage', express.static('categoryImages'))
app.use('/menuItemsImages', express.static('menuItemsImages'))

// ========================================
// API ROUTES
// ========================================

app.use('/user', authUser, userRouter)
app.use('/restaurants', restaurantRouter)

// ========================================
// 404 HANDLER
// ========================================

app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        err: `Cannot ${req.method} ${req.originalUrl}`,
        message: 'Route not found'
    })
})

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
    console.error('Error:', err)
    res.status(err.status || 500).json({
        status: 'error',
        err: err.message,
        message: 'Internal server error'
    })
})

// ========================================
// START SERVER (RAILWAY COMPATIBLE)
// ========================================

const PORT = process.env.PORT || 4000

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
})

// ========================================
// GRACEFUL SHUTDOWN (IMPORTANT FOR RAILWAY)
// ========================================

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...')
    server.close(() => {
        console.log('🛑 Server closed')
        process.exit(0)
    })
})

module.exports = app
