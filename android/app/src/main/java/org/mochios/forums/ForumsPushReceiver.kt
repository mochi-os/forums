package org.mochios.forums

import android.content.Context
import android.net.Uri
import org.mochios.android.push.MochiPushReceiver

class ForumsPushReceiver : MochiPushReceiver() {

    override fun channelId(context: Context, instance: String): String =
        ForumsApplication.NOTIFICATION_CHANNEL_ID

    override fun deepLinkFor(context: Context, instance: String, link: String): Uri =
        Uri.parse("mochi-forums://notification")
            .buildUpon()
            .appendQueryParameter("link", link)
            .build()
}
