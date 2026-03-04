function createResult(err, data) {
    result = {}
    if(data) {
        result.status = 'success'  ,
        result.data = data
    } else {
        result.status = 'error' ,
        result.err = err
    }
    return result
}

module.exports = { createResult }