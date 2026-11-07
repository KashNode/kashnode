package com.kashnode.app.data.remote
import android.content.Context
import com.kashnode.app.data.local.AuthPreferences
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit
data class LoginRequest(val email:String,val password:String,val device_id:String,val device_name:String="KashNode Android")
data class PairRequest(val pairing_token:String,val device_id:String,val device_name:String="KashNode Android")
data class AuthResponse(val status:String,val auth_token:String?,val expires_at:String?,val merchant_id:String?,val store_name:String?,val active_plan:String?,val device_role:String?,val message:String?)
data class WebSessionResponse(val dashboard_url:String?)
class AuthInterceptor(private val auth:AuthPreferences):Interceptor{
 override fun intercept(chain:Interceptor.Chain):okhttp3.Response{val s=auth.session();val b=chain.request().newBuilder().header("Accept","application/json");if(s!=null){b.header("Authorization","Bearer ${s.authToken}");s.merchantId?.let{b.header("X-Merchant-Id",it)}};return chain.proceed(b.build())}
}
interface KashNodeApi{
 @POST("api/auth/device-login") suspend fun login(@Body body:LoginRequest):AuthResponse
 @POST("api/devices/pair/claim") suspend fun claim(@Body body:PairRequest):AuthResponse
 @POST("api/auth/device-web-session") suspend fun webSession():retrofit2.Response<WebSessionResponse>
 @retrofit2.http.GET("api/auth/device-hmac-secret") suspend fun deviceHmacSecret():retrofit2.Response<Map<String,String>>
 @POST("api/auth/device-logout") suspend fun logout():retrofit2.Response<Unit>
}
object ApiClient{
 fun create(context:Context,url:String,auth:AuthPreferences):KashNodeApi{val base=url.trim().let{if(it.endsWith("/"))it else "$it/"};require(base.startsWith("https://")||base.startsWith("http://10.0.2.2/")){"Use HTTPS for the server URL."};val client=OkHttpClient.Builder().addInterceptor(AuthInterceptor(auth)).connectTimeout(20,TimeUnit.SECONDS).readTimeout(30,TimeUnit.SECONDS).build();return Retrofit.Builder().baseUrl(base).client(client).addConverterFactory(GsonConverterFactory.create()).build().create(KashNodeApi::class.java)}
}
