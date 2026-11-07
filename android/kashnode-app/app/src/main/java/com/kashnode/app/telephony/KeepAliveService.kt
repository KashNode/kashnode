package com.kashnode.app.telephony
import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.kashnode.app.MainActivity
class KeepAliveService:Service(){override fun onCreate(){super.onCreate();val id="kashnode_device";if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(id,"KashNode device service",NotificationManager.IMPORTANCE_LOW));val pi=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE);startForeground(4102,NotificationCompat.Builder(this,id).setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("KashNode is connected").setContentText("Device services are active").setOngoing(true).setContentIntent(pi).build())};override fun onStartCommand(i:Intent?,f:Int,id:Int)=START_STICKY;override fun onBind(i:Intent?):IBinder?=null}
