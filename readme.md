#cocos creator 网络工具包
这是一个被改良过的 cocos creator 的 pomelo 客户端包, 更加简单易用.

---

###调整说明

1. 支持 typescript 和 async await 异步语法.
2. 重写断线重连和认证的关系, 做到真正的逻辑解耦.
3. 升级 pomelo-protobuf 包, 支持 boolean 类型和 object 任意类型, 更加合理使用.

###安装

1. cocos creator

        /// 使用 npm 管理包
        npm install pomelo-creatot --save
2. cocos2d-js

    直接 copy 包内的 js 代码, 贴到工程内, 如有报错按需修改!

###使用

1. 初始化 pomelo 和事件

        import { pomelo } from "pomelo-creator";

        const client = pomelo.create("ws://127.0.0.1:9527", {
            auth: async function () {
                const accessToken: string = localStorage.getItem('accessToken');
                if (accessToken) {
                    const response: any = await client.request('connector.session.auth', { accessToken });
                    if (response.code !== 200) {
                        /// 移除失效的 token
                        localStorage.removeItem('accessToken');
                        return;
                    }
                    return response;
                }
                console.log("认证失败!");
                return;
            },
            localStorage: {
                setItem: localStorage.setItem.bind(localStorage),
                getItem: localStorage.getItem.bind(localStorage);
            },
            retry: 4
        });

        /// 认证通过触发( 断线重连也会自动执行 auth 函数, 完成后也会触发该事件 )
        client.on('ready', ( authData )=>{
            /// authData 就是 auth 的返回值

        });

        /// 错误
        client.on('error', ( error ) => {

        });

        /// 重试 retry 次数后 依然不能完成链接和认证, 触发
        client.on('getout', () => { 

        });

        /// socket 链接上触发, 注意区别 ready
        client.on('connected', ()=>{

        });

        /// 服务器主动断开 socket 链接
        client.on('kickout' ( reason )=>{
            
        });

2. 关于 protobuf 的改动

    需要说明的是 要激活使用这个改动的特性, 需要修改 pomelo 的源码, 使用 pomelo-protobuf-ts 这个模块, 或者服务器直接使用 pomelo-ts 这个包( 这是一个和本次同步改动的 pomelo 分支 );
   

        /// 这是一个配置实例: 用来限制客户端的 sessio.auth, 其中 object 和 boolean 是本次改动新加
        /// object 代表任意 JSON Object : 可以执行 JSON.stringify() 的对象
        /// boolean 代表 bool 类型
        {
            "connector.session.auth": {
                "required string accessToken": 1,
                "message Device": {
                    "required string uuid": 1,
                    "required object os": 2
                },
                "optional Device device": 2,
                "optional boolean newuser": 3,
                "repeated string logs": 4
            }
        }



###Issues
如有错误和偏颇 请移步 issues. 如果喜欢请给 star ! 谢谢 !