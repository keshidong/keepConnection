// error类型 todo:ts? 需要统一timeoutP定义的error和retry, next函数定义的error
const timeoutP = timeMS => (
    new Promise((resolve) => {
        setTimeout(() => { resolve([{ message: 'timeout' }]) }, timeMS)
    })
)

export const makeRetryUnlimited = (requestCall = () => {}, retryCall = () => (false)) => (request) => {
    const retryUnlimited = async (lastRequestRes) => {
        // hook
        await Promise.resolve(requestCall(lastRequestRes))
        const [requestErr, res] = await request(lastRequestRes)
        if (!requestErr) {
            return [null, res]
        }
        // console.log('retryErr', retryErr)
        // todo: 把await时机放在外部
        const isBreak = await Promise.resolve(
            retryCall(lastRequestRes, [requestErr, null]),
        )

        if (isBreak) {
            // break retry
            return [{ message: 'break retry' }, null]
        }

        // todo: del time
        return retryUnlimited(requestCall, retryCall)
    }
    return retryUnlimited
}

export const makeNextUnlimited = retryUnlimited => (
    requestCall = () => {},
    call = () => (false),
) => request => async function nextUnlimited(lastRequestRes = null) {
    // call表示调用请求次数，包括retry和next
    // init
    let nextRequestRes
    await Promise.resolve(requestCall(lastRequestRes))
    const [err, curRequestRes] = await request(lastRequestRes)
    if (err) {
        // 错误重试
        const [retryErr, retryRequestRes] = await retryUnlimited(lastRequestRes)
        if (retryErr) {
            // break retry
            return
        }

        nextRequestRes = retryRequestRes
    } else {
        nextRequestRes = curRequestRes
    }

    const isBreak = await Promise.resolve(call([null, data]))
    if (isBreak) {
        return
    }

    nextUnlimited(nextRequestRes)
}

const defaultIntervalTimeMS = 10000
const defaultRetryMinIntervalTimeMS = 10000
const defaultRetryMaxIntervalTimeMS = 30000

const keepConnection = async (request, requestCall, retryCall, call, {
    nextIntervalTimeMS = () => (defaultIntervalTimeMS),
    retryMinIntervalTimeMS = () => (defaultRetryMinIntervalTimeMS),
    retryMaxIntervalTimeMS = () => (defaultRetryMaxIntervalTimeMS),
}) => {
    const retryUnlimited = makeRetryUnlimited(retry, retryMinIntervalTimeMS, retryMaxIntervalTimeMS)
    const nextUnlimited = makeNextUnlimited(next, retryUnlimited, nextIntervalTimeMS)

    nextUnlimited(null, call)
}

export default keepConnection
